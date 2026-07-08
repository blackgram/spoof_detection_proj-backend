"""KYC onboarding and verification API."""

from __future__ import annotations

import base64
import io
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.db.firestore_client import FirestoreClient
from app.models.response import (
    LivenessStartResponse,
    MultiCaptureVerificationResponse,
    VerificationResponse,
)
from app.services import liveliness_client

logger = logging.getLogger(__name__)

# Firestore limit is 1 MiB (1,048,576 bytes) per field. Keep base64 under this.
FIRESTORE_MAX_BYTES = 1_048_576
REFERENCE_IMAGE_MAX_B64_BYTES = FIRESTORE_MAX_BYTES - 10_000  # safety margin


def _compress_reference_image(image_bytes: bytes, max_b64_len: int = REFERENCE_IMAGE_MAX_B64_BYTES) -> str:
    """Resize/compress image so base64 fits in Firestore. Returns base64 string."""
    try:
        from PIL import Image
    except ImportError:
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
        if quality > 40:
            quality -= 10
            continue
        w, h = img.size
        if w <= 400 and h <= 400:
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
    Spoof detection is deferred to the liveliness service at verification time.
    """
    if not reference_image.content_type or not reference_image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="reference_image must be an image file")
    image_bytes = await reference_image.read()
    if not image_bytes or len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="reference_image is empty")
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


def _get_customer_bvn_and_account(customer_id: str) -> tuple[str, str]:
    """Resolve customer's BVN and account_no from Firestore. Raises HTTPException on failure."""
    cust = db.get_customer_by_id(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    bvn = cust.get("bvn", "")
    account_no = db.get_customer_account_no(customer_id) or ""
    return bvn, account_no


@router.post("/verify", response_model=VerificationResponse)
async def kyc_verify(
    customer_id: str = Form(..., description="Customer id (from login / GET kyc-status)"),
    selfie_image: UploadFile = File(..., description="Live selfie for spoof detection and face match"),
):
    """
    KYC verification: delegates spoof detection and face verification to the
    external liveliness service.
    """
    if not selfie_image.content_type or not selfie_image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="selfie_image must be an image file")
    selfie_bytes = await selfie_image.read()
    if not selfie_bytes or len(selfie_bytes) == 0:
        raise HTTPException(status_code=400, detail="selfie_image is empty")

    bvn, account_no = _get_customer_bvn_and_account(customer_id)

    try:
        result = await liveliness_client.kyc_verify(
            bvn=bvn,
            account_no=account_no,
            selfie_image=selfie_bytes,
        )
    except httpx.HTTPStatusError as exc:
        logger.error("Liveliness service kyc/verify failed: %s %s", exc.response.status_code, exc.response.text)
        raise HTTPException(status_code=502, detail="Liveliness service returned an error")
    except Exception as exc:
        logger.error("Liveliness service kyc/verify error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach liveliness service")

    return VerificationResponse(**result)


# ─────────────────────────────────────────────────────────────────────────────
# Flow B: multi-capture liveness — delegated to the external liveliness service
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/liveness/start", response_model=LivenessStartResponse)
async def kyc_liveness_start(customer_id: str = Form(...)):
    """Issue a randomised multi-capture liveness challenge for a customer."""
    logger.info("Liveness start requested customer_id=%s", customer_id)
    bvn, account_no = _get_customer_bvn_and_account(customer_id)

    try:
        result = await liveliness_client.liveness_start(
            customer_bvn=bvn,
            account_no=account_no,
            app_id=customer_id,
        )
    except httpx.HTTPStatusError as exc:
        logger.error("Liveliness service liveness/start failed: %s %s", exc.response.status_code, exc.response.text)
        raise HTTPException(status_code=502, detail="Liveliness service returned an error")
    except Exception as exc:
        logger.error("Liveliness service liveness/start error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach liveliness service")

    # Map the external service's customer_id field back to our own customer_id
    result["customer_id"] = customer_id
    logger.info(
        "Liveness session created session_id=%s customer_id=%s prompts=%s",
        result.get("session_id"),
        customer_id,
        result.get("prompts"),
    )
    return LivenessStartResponse(**result)


@router.post("/liveness/verify", response_model=MultiCaptureVerificationResponse)
async def kyc_liveness_verify(
    customer_id: str = Form(...),
    session_id: str = Form(...),
    nonce: str = Form("", description="Nonce from liveness/start response"),
    timestamps: str = Form(..., description="JSON array of epoch-ms, one per frame"),
    frame_0: UploadFile = File(..., description="Frame for prompt_0 (always 'look_straight')"),
    frame_1: UploadFile = File(...),
    frame_2: Optional[UploadFile] = File(default=None),
    frame_3: Optional[UploadFile] = File(default=None),
    frame_4: Optional[UploadFile] = File(default=None),
):
    """
    Verify a multi-capture liveness session. All spoof detection, replay signal
    analysis, and face verification is delegated to the external liveliness service.
    """
    logger.info("Liveness verify requested customer_id=%s session_id=%s", customer_id, session_id)

    # Collect submitted frames in prompt order.
    raw_frames = [f for f in [frame_0, frame_1, frame_2, frame_3, frame_4] if f is not None]

    frame_bytes_list: list[bytes] = []
    for i, upload in enumerate(raw_frames):
        if not upload.content_type or not upload.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"frame_{i} must be an image")
        b = await upload.read()
        if not b:
            raise HTTPException(status_code=400, detail=f"frame_{i} is empty")
        frame_bytes_list.append(b)

    try:
        result = await liveliness_client.liveness_verify(
            session_id=session_id,
            nonce=nonce,
            timestamps=timestamps,
            frames=frame_bytes_list,
        )
    except httpx.HTTPStatusError as exc:
        logger.error("Liveliness service liveness/verify failed: %s %s", exc.response.status_code, exc.response.text)
        raise HTTPException(status_code=502, detail="Liveliness service returned an error")
    except Exception as exc:
        logger.error("Liveliness service liveness/verify error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach liveliness service")

    # Update KYC status locally when the liveliness service says pass
    overall = result.get("overall_result", "")
    if overall == "pass":
        db.set_kyc_completed(customer_id, True)
        logger.info("Liveness pass: kyc_completed set for customer_id=%s session_id=%s", customer_id, session_id)

    logger.info(
        "Liveness adjudication session_id=%s overall=%s",
        session_id,
        overall,
    )

    return MultiCaptureVerificationResponse(**result)

