"""
KYC-aligned routes without Firestore: reference face from Access Bank AccountImageCollection only.

- POST /api/kyc/verify — account_no + selfie (spoof + 1:1 vs bank image)
- POST /api/kyc/liveness/start — subject_id (opaque id; returned as customer_id in JSON for compatibility)
- POST /api/kyc/liveness/verify — subject_id + account_no + frames (same adjudication as monolith)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.response import (
    LivenessStartResponse,
    MultiCaptureVerificationResponse,
    PerFrameScore,
    ReplaySignals,
    VerificationResponse,
)
from app.services import replay_signals as replay_signals_service
from app.services.account_image import fetch_account_images
from app.services.liveness_session import get_store as get_liveness_store
from app.services.loader import get_face_verification_service, get_spoof_detection_service

logger = logging.getLogger(__name__)

_MAX_LIVENESS_FRAMES = 5
_MIN_FRAME_GAP_MS = 250
_MAX_FRAME_GAP_MS = 60_000

router = APIRouter(prefix="/api/kyc", tags=["kyc"])


async def _references_from_bank_only(account_no: str) -> List[bytes]:
    """Fetch reference images from Access Bank; no Firestore fallback."""
    images = await fetch_account_images(account_no)
    if not images:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not retrieve reference image from AccountImageCollection. "
                "Check account_no, ACCESS_BANK_EFM_URL, and ACCESS_BANK_EFM_AUTH_TOKEN."
            ),
        )
    return images


async def _best_face_verification(reference_images: List[bytes], probe_image: bytes) -> dict:
    """
    Verify probe against all available reference images and return the best result.
    Priority:
      1) any verified result (highest confidence among verified)
      2) otherwise highest confidence non-verified result
    """
    verifier = get_face_verification_service()
    best_verified: Optional[dict] = None
    best_non_verified: Optional[dict] = None

    for idx, ref in enumerate(reference_images):
        result = await verifier.verify_faces(ref, probe_image)
        logger.info(
            "Face verification candidate idx=%d verified=%s confidence=%.4f distance=%.4f",
            idx,
            result["verified"],
            float(result["confidence"]),
            float(result["distance"]),
        )
        if result["verified"]:
            if best_verified is None or float(result["confidence"]) > float(best_verified["confidence"]):
                best_verified = result
        else:
            if best_non_verified is None or float(result["confidence"]) > float(best_non_verified["confidence"]):
                best_non_verified = result

    return best_verified or best_non_verified or {"verified": False, "confidence": 0.0, "distance": 1.0}


@router.post("/verify", response_model=VerificationResponse)
async def kyc_verify_with_bank_image(
    account_no: str = Form(..., description="Bank account number used for AccountImageCollection"),
    selfie_image: UploadFile = File(..., description="Live selfie for spoof detection and face match"),
):
    """Spoof detection on selfie, then face verification vs bank reference image only."""
    if not selfie_image.content_type or not selfie_image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="selfie_image must be an image file")
    selfie_bytes = await selfie_image.read()
    if not selfie_bytes:
        raise HTTPException(status_code=400, detail="selfie_image is empty")

    reference_images = await _references_from_bank_only(account_no.strip())

    spoof_result = await get_spoof_detection_service().detect_spoof(selfie_bytes)
    if not spoof_result["is_real"]:
        return VerificationResponse(
            liveness_check={"is_real": False, "confidence": spoof_result["confidence"]},
            face_verification={"verified": False, "confidence": 0.0, "distance": 1.0},
            overall_result="spoof_detected",
            message=spoof_result.get("reason", "Spoof detected. Please use a live selfie."),
        )

    verification_result = await _best_face_verification(reference_images, selfie_bytes)
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


@router.post("/liveness/start", response_model=LivenessStartResponse)
async def liveness_start(
    customer_bvn: str = Form(..., description="11-digit BVN"),
    account_no: str = Form(..., description="Customer account number"),
    app_id: str = Form(..., description="Calling application identifier"),
):
    """Issue a multi-capture liveness challenge; no customer DB lookup."""
    sid = (customer_bvn or "").strip()
    if not sid:
        raise HTTPException(status_code=400, detail="customer_bvn is required")

    session = get_liveness_store().create(customer_id=sid)
    logger.info(
        "Liveness session created session_id=%s bvn=%s account_no=%s app_id=%s prompts=%s expires_at=%s",
        session.session_id,
        sid,
        account_no,
        app_id,
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
    for i in range(1, len(timestamps)):
        gap = timestamps[i] - timestamps[i - 1]
        if gap < _MIN_FRAME_GAP_MS:
            return f"frame gap too small between {i-1}->{i}: {gap}ms"
        if gap > _MAX_FRAME_GAP_MS:
            return f"frame gap too large between {i-1}->{i}: {gap}ms"
    return None


@router.post("/liveness/verify", response_model=MultiCaptureVerificationResponse)
async def liveness_verify(
    subject_id: str = Form(..., description="Same id as used in /liveness/start"),
    account_no: str = Form(..., description="Bank account number for AccountImageCollection reference"),
    session_id: str = Form(...),
    timestamps: str = Form(..., description="JSON array of epoch-ms, one per frame"),
    frame_0: UploadFile = File(..., description="Frame for prompt_0 (always 'look_straight')"),
    frame_1: UploadFile = File(...),
    frame_2: Optional[UploadFile] = File(default=None),
    frame_3: Optional[UploadFile] = File(default=None),
    frame_4: Optional[UploadFile] = File(default=None),
):
    """Verify multi-capture session: PAD + replay signals + face match vs bank reference."""
    sid = (subject_id or "").strip()
    store = get_liveness_store()
    logger.info("Liveness verify requested subject_id=%s session_id=%s", sid, session_id)

    session = store.get(session_id)
    if not session:
        logger.warning("Liveness verify failed: session missing/expired session_id=%s", session_id)
        raise HTTPException(status_code=404, detail="Liveness session not found or expired")
    if session.customer_id != sid:
        logger.warning(
            "Liveness verify failed: subject mismatch session_id=%s expected=%s got=%s",
            session_id,
            session.customer_id,
            sid,
        )
        raise HTTPException(status_code=403, detail="Session does not belong to this subject")
    if session.consumed:
        logger.warning("Liveness verify failed: session already consumed session_id=%s", session_id)
        raise HTTPException(status_code=409, detail="Session already consumed")
    if datetime.now(timezone.utc) > session.expires_at:
        store.invalidate(session_id)
        logger.warning("Liveness verify failed: session expired session_id=%s", session_id)
        raise HTTPException(status_code=410, detail="Liveness session expired")

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

    frame_bytes: List[bytes] = []
    for i, upload in enumerate(raw_frames):
        if not upload.content_type or not upload.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"frame_{i} must be an image")
        b = await upload.read()
        if not b:
            raise HTTPException(status_code=400, detail=f"frame_{i} is empty")
        frame_bytes.append(b)

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

    reference_images = await _references_from_bank_only(account_no.strip())

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

    frontal_bytes = frame_bytes[0]
    try:
        face_res = await _best_face_verification(reference_images, frontal_bytes)
    except ValueError as ve:
        logger.info("Face verification issue for session=%s: %s", session_id, ve)
        face_res = {"verified": False, "confidence": 0.0, "distance": 1.0}
        risk_flags.append("face_not_detected_on_frontal")
    except Exception as e:
        logger.warning("Face verification errored for session=%s: %s", session_id, e)
        face_res = {"verified": False, "confidence": 0.0, "distance": 1.0}
        risk_flags.append("face_verification_error")

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

    min_real_conf = min((p.confidence for p in per_frame), default=0.0)
    overall_is_real = spoof_hits == 0 and not (
        replay_block.is_suspicious_identical
        or replay_block.is_suspicious_scene_change
        or replay_block.is_suspicious_uniform_brightness
    )

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
