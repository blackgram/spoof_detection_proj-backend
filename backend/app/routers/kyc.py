"""KYC onboarding and verification API."""

import base64
import io
import logging
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.db.firestore_client import FirestoreClient
from app.models.response import VerificationResponse
from app.services.loader import get_face_verification_service, get_spoof_detection_service

logger = logging.getLogger(__name__)

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


@router.post("/onboard")
async def kyc_onboard(
    bvn: str = Form(..., description="Bank Verification Number"),
    customer_id: str | None = Form(None, description="Existing customer id; if not set, customer is found/created by BVN"),
    name: str | None = Form(None, description="Customer name (used when creating new)"),
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
    reference_bytes = db.get_customer_reference_image(customer_id)
    if not reference_bytes:
        raise HTTPException(
            status_code=400,
            detail="No KYC reference image on file. Complete KYC onboarding first.",
        )
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
