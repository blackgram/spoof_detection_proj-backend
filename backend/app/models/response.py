"""Pydantic response models for the API."""

from pydantic import BaseModel


class LivenessCheckResult(BaseModel):
    """Result of liveness/spoof detection check."""

    is_real: bool
    confidence: float


class FaceVerificationResult(BaseModel):
    """Result of face verification (1:1 matching)."""

    verified: bool
    confidence: float
    distance: float


class VerificationResponse(BaseModel):
    """Combined response for the /api/verify endpoint."""

    liveness_check: LivenessCheckResult
    face_verification: FaceVerificationResult
    overall_result: str  # "pass" | "fail" | "spoof_detected"
    message: str
