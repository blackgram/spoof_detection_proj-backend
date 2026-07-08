"""Pydantic response models for the API."""

from typing import List, Optional

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


# ─── Flow B: in-house multi-capture liveness ───

class LivenessStartResponse(BaseModel):
    """Server-issued challenge for an in-house multi-capture liveness session."""

    session_id: str
    customer_id: str
    nonce: str = ""                 # opaque nonce from liveliness service
    prompts: List[str]              # ordered prompts, e.g. ["look_straight", "turn_left", "smile"]
    expires_at: str                 # ISO-8601 UTC
    max_retries: int


class PerFrameScore(BaseModel):
    """Per-frame spoof-detection result within a multi-capture session."""

    prompt: str
    is_real: bool
    confidence: float
    reason: Optional[str] = None


class ReplaySignals(BaseModel):
    """Cross-frame sanity checks designed to catch replay/injected-photo attacks."""

    phash_distances: List[int]                # hamming distances between consecutive frames
    brightness_stddev_spread: float           # variance of per-frame mean brightness
    is_suspicious_identical: bool             # frames look like the SAME still image (replay)
    is_suspicious_scene_change: bool          # frames differ far beyond expected pose change
    is_suspicious_uniform_brightness: bool    # brightness too uniform (screen capture)
    notes: List[str] = []


class MultiCaptureVerificationResponse(VerificationResponse):
    """Response for POST /api/kyc/liveness/verify."""

    session_id: str
    per_frame_scores: List[PerFrameScore]
    replay_signals: ReplaySignals
    risk_flags: List[str] = []
    # Possible overall_result values:
    #   "pass" | "fail" | "spoof_detected" | "step_up" | "retry"
