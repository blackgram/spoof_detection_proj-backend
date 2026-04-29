"""KYC onboarding and verification API."""

from __future__ import annotations

import base64
import io
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.db.firestore_client import FirestoreClient
from app.models.response import (
    LivenessStartResponse,
    MultiCaptureVerificationResponse,
    PerFrameScore,
    ReplaySignals,
    VerificationResponse,
)
from app.services import replay_signals as replay_signals_service
from app.services.account_image import fetch_account_image
from app.services.liveness_session import get_store as get_liveness_store
from app.services.loader import get_face_verification_service, get_spoof_detection_service

logger = logging.getLogger(__name__)

# Max frames the multi-capture endpoint will accept. Matches prompt count policy.
_MAX_LIVENESS_FRAMES = 5
# Minimum gap between consecutive frame timestamps (ms). Anything tighter is
# almost certainly a programmatic replay of pre-staged images.
_MIN_FRAME_GAP_MS = 250
# Maximum gap between consecutive frames (ms). Prevents frames from a long-ago
# separate session being re-submitted.
_MAX_FRAME_GAP_MS = 60_000

# Firestore limit is 1 MiB (1,048,576 bytes) per field. Keep base64 under this.
FIRESTORE_MAX_BYTES = 1_048_576
REFERENCE_IMAGE_MAX_B64_BYTES = FIRESTORE_MAX_BYTES - 10_000  # safety margin


def _compress_reference_image(image_bytes: bytes, max_b64_len: int = REFERENCE_IMAGE_MAX_B64_BYTES) -> str:
    """Resize/compress image so base64 fits in Firestore. Returns base64 string."""
    try:
        from PIL import Image
    except ImportError:
        # No Pillow: encode as-is and truncate (bad fallback)
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        if len(b64) <= max_b64_len:
            return b64
        raise HTTPException(
            status_code=400,
            detail=f"Reference image too large for storage ({len(b64)} bytes). Install Pillow for automatic compression.",
        )
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    quality = 85
    out = io.BytesIO()
    while True:
        out.seek(0)
        out.truncate()
        img.save(out, format="JPEG", quality=quality, optimize=True)
        raw_len = out.tell()
        b64 = base64.b64encode(out.getvalue()).decode("utf-8")
        if len(b64) <= max_b64_len:
            logger.info("Reference image compressed to %d bytes (base64 len %d)", raw_len, len(b64))
            return b64
        # Reduce size: shrink dimensions then lower quality
        if quality > 40:
            quality -= 10
            continue
        w, h = img.size
        if w <= 400 and h <= 400:
            # Already small; last resort: lower quality more
            quality = max(25, quality - 15)
            out.seek(0)
            out.truncate()
            img.save(out, format="JPEG", quality=quality, optimize=True)
            b64 = base64.b64encode(out.getvalue()).decode("utf-8")
            if len(b64) <= max_b64_len:
                return b64
            raise HTTPException(status_code=400, detail="Reference image too large even after compression.")
        img = img.resize((w // 2, h // 2), Image.Resampling.LANCZOS)
        quality = 85


router = APIRouter(prefix="/api/kyc", tags=["kyc"])
db = FirestoreClient()


async def _get_reference_image(customer_id: str) -> bytes:
    """
    Resolve the authoritative reference image for a customer.

    Resolution order:
    1. Call Access Bank AccountImageCollection API using the stored account_no.
       This is the ground-truth photo captured at account opening and is
       always preferred over the locally uploaded reference.
    2. Fall back to the base64 reference image stored in Firestore (set
       during onboarding via /api/kyc/onboard) if the API call fails or
       returns no image.

    Raises HTTPException(400) when neither source yields an image.
    """
    account_no = db.get_customer_account_no(customer_id)
    logger.info(
        "Resolving reference image customer_id=%s account_no_present=%s",
        customer_id,
        bool(account_no),
    )
    if account_no:
        img = await fetch_account_image(account_no)
        if img:
            logger.info("Using Access Bank account image for customer=%s account_no=%s", customer_id, account_no)
            return img
        logger.warning(
            "Access Bank image fetch failed for customer=%s account_no=%s — falling back to stored reference",
            customer_id, account_no,
        )

    # Fallback: locally stored reference from /api/kyc/onboard
    stored = db.get_customer_reference_image(customer_id)
    if stored:
        logger.info("Using stored Firestore reference image for customer=%s", customer_id)
        return stored

    raise HTTPException(
        status_code=400,
        detail=(
            "No reference image available. Ensure the account number is linked "
            "to a customer profile and the Access Bank image service is reachable."
        ),
    )


@router.post("/onboard")
async def kyc_onboard(
    bvn: str = Form(..., description="Bank Verification Number"),
    customer_id: Optional[str] = Form(None, description="Existing customer id; if not set, customer is found/created by BVN"),
    name: Optional[str] = Form(None, description="Customer name (used when creating new)"),
    reference_image: UploadFile = File(..., description="Well-lit, clear face image for KYC reference"),
):
    """
    KYC onboarding: save customer's reference image and set kyc_completed=True.
    Client sends BVN and a single well-lit reference image (no selfie comparison here).
    """
    if not reference_image.content_type or not reference_image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="reference_image must be an image file")
    image_bytes = await reference_image.read()
    if not image_bytes or len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="reference_image is empty")
    # Optional: run spoof check on the reference image so we don't store a photo of a screen
    try:
        spoof = await get_spoof_detection_service().detect_spoof(image_bytes)
        if not spoof["is_real"]:
            raise HTTPException(
                status_code=400,
                detail="Reference image failed liveness check. Please use a real, well-lit face photo.",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Spoof check on reference image failed: %s", e)
        # Proceed anyway for PoC if spoof service fails
    # Find or create customer
    customer_id_val = customer_id
    if not customer_id_val:
        existing = db.get_customer_by_bvn(bvn)
        if existing:
            customer_id_val = existing["id"]
        else:
            customer_id_val = db.create_customer(bvn=bvn, name=name or "Customer", email=None, phone=None)
    else:
        cust = db.get_customer_by_id(customer_id_val)
        if not cust:
            raise HTTPException(status_code=404, detail="Customer not found")
        # Update BVN and name when completing KYC for a username-created customer
        db.update_customer_bvn_and_name(customer_id_val, bvn, name or cust.get("name") or "Customer")
    # Compress so base64 fits Firestore 1 MiB limit, then store
    b64 = _compress_reference_image(image_bytes)
    ok = db.update_customer_kyc_reference(customer_id_val, b64)
    if not ok:
        raise HTTPException(status_code=404, detail="Customer not found")
    # Ensure customer has at least one account for transfers (PoC: one account per customer)
    if not db.get_accounts(customer_id_val):
        import hashlib
        suffix = hashlib.sha256(customer_id_val.encode()).hexdigest()[:9]
        account_number = "9" + suffix  # 10-digit style
        # Start every new customer with a balance of 500,000,000 NGN (PoC)
        db.add_account(customer_id_val, account_number, "current", 500_000_000.0)
    logger.info("KYC onboarding completed for customer_id=%s", customer_id_val)
    return {"customer_id": customer_id_val, "kyc_completed": True, "message": "KYC onboarding successful."}


@router.post("/verify", response_model=VerificationResponse)
async def kyc_verify(
    customer_id: str = Form(..., description="Customer id (from login / GET kyc-status)"),
    selfie_image: UploadFile = File(..., description="Live selfie for spoof detection and face match"),
):
    """
    KYC verification: compare selfie to stored reference.
    Runs spoof detection on selfie, then face verification (selfie vs stored reference).
    """
    if not selfie_image.content_type or not selfie_image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="selfie_image must be an image file")
    selfie_bytes = await selfie_image.read()
    if not selfie_bytes or len(selfie_bytes) == 0:
        raise HTTPException(status_code=400, detail="selfie_image is empty")
    reference_bytes = await _get_reference_image(customer_id)
    # 1) Spoof detection on selfie
    spoof_result = await get_spoof_detection_service().detect_spoof(selfie_bytes)
    if not spoof_result["is_real"]:
        return VerificationResponse(
            liveness_check={"is_real": False, "confidence": spoof_result["confidence"]},
            face_verification={"verified": False, "confidence": 0.0, "distance": 1.0},
            overall_result="spoof_detected",
            message=spoof_result.get("reason", "Spoof detected. Please use a live selfie."),
        )
    # 2) Face verification: selfie vs stored reference
    verification_result = await get_face_verification_service().verify_faces(reference_bytes, selfie_bytes)
    if verification_result["verified"]:
        overall_result = "pass"
        message = "Identity verified successfully. Face matches and liveness check passed."
    else:
        overall_result = "fail"
        message = f"Face verification failed. Faces do not match (confidence: {verification_result['confidence']:.2%})."
    return VerificationResponse(
        liveness_check={"is_real": True, "confidence": spoof_result["confidence"]},
        face_verification={
            "verified": verification_result["verified"],
            "confidence": verification_result["confidence"],
            "distance": verification_result["distance"],
        },
        overall_result=overall_result,
        message=message,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Flow B: in-house multi-capture liveness
#
# Flow:
#   1) Client calls POST /api/kyc/liveness/start with a customer_id.
#      Server issues a randomised prompt sequence + short-lived session_id.
#   2) Client shows each prompt, captures a frame per prompt.
#   3) Client calls POST /api/kyc/liveness/verify with:
#        - session_id, customer_id
#        - frame_0, frame_1, frame_2 (... up to N frames)
#        - timestamps (JSON array of ms epochs, one per frame)
#      Server:
#        - validates session (exists, not expired, not consumed, belongs to
#          customer)
#        - validates timing (monotonic, sane gaps)
#        - runs Silent Face PAD on every frame
#        - runs cross-frame replay signals (dHash, brightness stddev)
#        - runs DeepFace ArcFace match of frame_0 ("look_straight") against
#          the stored reference image
#        - adjudicates:
#            * >= 2 frames flagged spoof       -> spoof_detected
#            * replay signal tripped           -> step_up
#            * face mismatch + any spoof flag  -> spoof_detected
#            * face mismatch alone             -> fail
#            * 1 frame spoof flag + face match -> retry
#            * clean pass                      -> pass
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/liveness/start", response_model=LivenessStartResponse)
async def kyc_liveness_start(customer_id: str = Form(...)):
    """Issue a randomised multi-capture liveness challenge for a customer."""
    logger.info("Liveness start requested customer_id=%s", customer_id)
    cust = db.get_customer_by_id(customer_id)
    if not cust:
        logger.warning("Liveness start rejected: customer not found customer_id=%s", customer_id)
        raise HTTPException(status_code=404, detail="Customer not found")

    # Prompt-count could later be risk-tiered (e.g. higher-risk txns = 4 prompts).
    session = get_liveness_store().create(customer_id=customer_id)
    logger.info(
        "Liveness session created session_id=%s customer_id=%s prompts=%s expires_at=%s",
        session.session_id,
        session.customer_id,
        session.prompts,
        session.expires_at.isoformat(),
    )

    return LivenessStartResponse(
        session_id=session.session_id,
        customer_id=session.customer_id,
        prompts=session.prompts,
        expires_at=session.expires_at.isoformat(),
        max_retries=2,
    )


def _parse_timestamps(raw: Optional[str], expected_len: int) -> List[int]:
    if not raw:
        raise HTTPException(status_code=400, detail="timestamps is required")
    try:
        parsed = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="timestamps must be a JSON array of ms epochs")
    if not isinstance(parsed, list) or len(parsed) != expected_len:
        raise HTTPException(
            status_code=400,
            detail=f"timestamps must have exactly {expected_len} entries",
        )
    try:
        return [int(x) for x in parsed]
    except Exception:
        raise HTTPException(status_code=400, detail="timestamps must be integer ms epochs")


def _validate_timing(timestamps: List[int]) -> Optional[str]:
    """Return None when timing is acceptable, otherwise a human-readable reason."""
    for i in range(1, len(timestamps)):
        gap = timestamps[i] - timestamps[i - 1]
        if gap < _MIN_FRAME_GAP_MS:
            return f"frame gap too small between {i-1}->{i}: {gap}ms"
        if gap > _MAX_FRAME_GAP_MS:
            return f"frame gap too large between {i-1}->{i}: {gap}ms"
    return None


@router.post("/liveness/verify", response_model=MultiCaptureVerificationResponse)
async def kyc_liveness_verify(
    customer_id: str = Form(...),
    session_id: str = Form(...),
    timestamps: str = Form(..., description="JSON array of epoch-ms, one per frame"),
    frame_0: UploadFile = File(..., description="Frame for prompt_0 (always 'look_straight')"),
    frame_1: UploadFile = File(...),
    frame_2: Optional[UploadFile] = File(default=None),
    frame_3: Optional[UploadFile] = File(default=None),
    frame_4: Optional[UploadFile] = File(default=None),
):
    """
    Verify a multi-capture liveness session: per-frame PAD + replay signals +
    face match against the stored reference image. Server is authoritative.
    """
    store = get_liveness_store()
    logger.info("Liveness verify requested customer_id=%s session_id=%s", customer_id, session_id)
    session = store.get(session_id)
    if not session:
        logger.warning("Liveness verify failed: session missing/expired session_id=%s", session_id)
        raise HTTPException(status_code=404, detail="Liveness session not found or expired")
    if session.customer_id != customer_id:
        logger.warning(
            "Liveness verify failed: customer mismatch session_id=%s expected=%s got=%s",
            session_id,
            session.customer_id,
            customer_id,
        )
        raise HTTPException(status_code=403, detail="Session does not belong to this customer")
    if session.consumed:
        logger.warning("Liveness verify failed: session already consumed session_id=%s", session_id)
        raise HTTPException(status_code=409, detail="Session already consumed")
    if datetime.now(timezone.utc) > session.expires_at:
        store.invalidate(session_id)
        logger.warning("Liveness verify failed: session expired session_id=%s", session_id)
        raise HTTPException(status_code=410, detail="Liveness session expired")

    # Collect submitted frames in prompt order.
    raw_frames: List[UploadFile] = [
        f for f in [frame_0, frame_1, frame_2, frame_3, frame_4] if f is not None
    ]
    if len(raw_frames) != len(session.prompts):
        logger.warning(
            "Liveness verify frame count mismatch session_id=%s expected=%d got=%d",
            session_id,
            len(session.prompts),
            len(raw_frames),
        )
        raise HTTPException(
            status_code=400,
            detail=(
                f"Expected {len(session.prompts)} frames matching prompts "
                f"{session.prompts}, got {len(raw_frames)}"
            ),
        )
    if len(raw_frames) > _MAX_LIVENESS_FRAMES:
        raise HTTPException(status_code=400, detail="Too many frames")

    # Read bytes + validate content-type.
    frame_bytes: List[bytes] = []
    for i, upload in enumerate(raw_frames):
        if not upload.content_type or not upload.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"frame_{i} must be an image")
        b = await upload.read()
        if not b:
            raise HTTPException(status_code=400, detail=f"frame_{i} is empty")
        frame_bytes.append(b)

    # Timestamp validation.
    ts = _parse_timestamps(timestamps, expected_len=len(frame_bytes))
    timing_error = _validate_timing(ts)
    logger.info(
        "Liveness verify payload session_id=%s frames=%d timestamps=%d",
        session_id,
        len(frame_bytes),
        len(ts),
    )

    risk_flags: List[str] = []
    if timing_error:
        risk_flags.append("timing_anomaly")
        logger.info("Liveness session %s timing anomaly: %s", session_id, timing_error)

    # Reference image for face matching — fetched from Access Bank API (with Firestore fallback).
    reference_bytes = await _get_reference_image(customer_id)

    # 1) Per-frame Silent Face PAD.
    spoof_service = get_spoof_detection_service()
    per_frame: List[PerFrameScore] = []
    spoof_hits = 0
    for prompt, fb in zip(session.prompts, frame_bytes):
        try:
            res = await spoof_service.detect_spoof(fb)
            is_real = bool(res.get("is_real"))
            conf = float(res.get("confidence", 0.0))
            reason = res.get("reason")
        except Exception as e:
            logger.warning("Spoof detection errored on prompt=%s: %s", prompt, e)
            is_real = False
            conf = 0.0
            reason = f"detection_error: {e}"
        if not is_real:
            spoof_hits += 1
        per_frame.append(
            PerFrameScore(prompt=prompt, is_real=is_real, confidence=conf, reason=reason)
        )
    logger.info(
        "Liveness spoof summary session_id=%s spoof_hits=%d total_frames=%d",
        session_id,
        spoof_hits,
        len(frame_bytes),
    )

    # 2) Cross-frame replay signals.
    distances, brightness_stddev, notes = replay_signals_service.analyse_frames(frame_bytes)
    classifications = replay_signals_service.classify(distances, brightness_stddev)

    replay_block = ReplaySignals(
        phash_distances=distances,
        brightness_stddev_spread=brightness_stddev,
        is_suspicious_identical=classifications["is_suspicious_identical"],
        is_suspicious_scene_change=classifications["is_suspicious_scene_change"],
        is_suspicious_uniform_brightness=classifications["is_suspicious_uniform_brightness"],
        notes=notes,
    )

    if replay_block.is_suspicious_identical:
        risk_flags.append("replay_identical_frames")
    if replay_block.is_suspicious_scene_change:
        risk_flags.append("scene_change_between_frames")
    if replay_block.is_suspicious_uniform_brightness:
        risk_flags.append("uniform_brightness_screen_capture")

    # 3) Face verification against stored reference using frame_0 (look_straight).
    frontal_bytes = frame_bytes[0]
    try:
        face_res = await get_face_verification_service().verify_faces(reference_bytes, frontal_bytes)
    except ValueError as ve:
        # Treat "face not detected" as a soft fail with step_up rather than 400 — we
        # already have other signals and the caller needs a single consistent shape.
        logger.info("Face verification issue for session=%s: %s", session_id, ve)
        face_res = {"verified": False, "confidence": 0.0, "distance": 1.0}
        risk_flags.append("face_not_detected_on_frontal")
    except Exception as e:
        logger.warning("Face verification errored for session=%s: %s", session_id, e)
        face_res = {"verified": False, "confidence": 0.0, "distance": 1.0}
        risk_flags.append("face_verification_error")

    # ─── Adjudication ───
    face_match = bool(face_res["verified"])

    if spoof_hits >= 2:
        overall = "spoof_detected"
        message = f"Liveness failed: {spoof_hits} of {len(frame_bytes)} frames flagged as spoof."
    elif not face_match and spoof_hits >= 1:
        overall = "spoof_detected"
        message = "Liveness failed: face did not match reference and frames appear non-live."
    elif replay_block.is_suspicious_identical or replay_block.is_suspicious_scene_change:
        overall = "step_up"
        message = (
            "Liveness frames look suspicious (possible replay or scene change). "
            "Please complete a secondary verification step."
        )
    elif replay_block.is_suspicious_uniform_brightness:
        overall = "step_up"
        message = (
            "Liveness frames show unnatural lighting consistency. Please complete a "
            "secondary verification step."
        )
    elif timing_error:
        overall = "step_up"
        message = "Liveness frame timing looks unusual. Please complete a secondary verification step."
    elif not face_match:
        overall = "fail"
        message = (
            f"Face did not match reference (confidence: {face_res['confidence']:.2%})."
        )
    elif spoof_hits == 1:
        overall = "retry"
        message = "One frame was inconclusive. Please retry the challenge."
    else:
        overall = "pass"
        message = "Liveness passed. Face matches reference and all frames look live."

    # Aggregate liveness: min per-frame confidence is a conservative summary.
    min_real_conf = min((p.confidence for p in per_frame), default=0.0)
    overall_is_real = spoof_hits == 0 and not (
        replay_block.is_suspicious_identical
        or replay_block.is_suspicious_scene_change
        or replay_block.is_suspicious_uniform_brightness
    )

    # Consume the session when we reach a terminal-ish state.
    if overall in ("pass", "spoof_detected", "fail"):
        store.mark_consumed(session_id)
    elif overall == "retry":
        store.bump_retry(session_id)

    logger.info(
        "Liveness adjudication session_id=%s overall=%s face_match=%s risk_flags=%s timing_error=%s",
        session_id,
        overall,
        face_match,
        risk_flags,
        timing_error or "none",
    )

    return MultiCaptureVerificationResponse(
        liveness_check={"is_real": overall_is_real, "confidence": min_real_conf},
        face_verification={
            "verified": face_match,
            "confidence": float(face_res["confidence"]),
            "distance": float(face_res["distance"]),
        },
        overall_result=overall,
        message=message,
        session_id=session_id,
        per_frame_scores=per_frame,
        replay_signals=replay_block,
        risk_flags=risk_flags,
    )
