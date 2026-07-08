"""HTTP client for the external liveliness / spoof-detection service."""

from __future__ import annotations

import logging
import os
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

_LIVELINESS_BASE_URL = os.environ.get("LIVELINESS_SERVICE_URL", "http://localhost:8001")
_CLIENT_ID = os.environ.get("LIVELINESS_CLIENT_ID", "liveliness")
_CLIENT_SECRET = os.environ.get(
    "LIVELINESS_CLIENT_SECRET",
    "3F9kPvb2uPjuamGtMn8UmyRbW2woILksI874e2hwvKWDHQot/58wPEiBCSZevhyB",
)

# Generous timeout: the service may need to warm up ML models on first call.
_TIMEOUT = httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0)


def _auth_headers() -> Dict[str, str]:
    return {
        "X-Client-Id": _CLIENT_ID,
        "X-Client-Secret": _CLIENT_SECRET,
        "Accept": "application/json",
    }


async def kyc_verify(
    *,
    bvn: str,
    account_no: str,
    selfie_image: bytes,
    reference_image: Optional[bytes] = None,
) -> dict:
    """
    Call POST /api/kyc/verify on the liveliness service.

    Returns the parsed JSON response (VerificationResponse shape).
    """
    url = f"{_LIVELINESS_BASE_URL}/api/kyc/verify"
    files: dict = {"selfie_image": ("selfie.jpg", selfie_image, "image/jpeg")}
    data: dict = {"bvn": bvn, "account_no": account_no}
    if reference_image:
        files["image"] = ("reference.jpg", reference_image, "image/jpeg")

    logger.info("→ POST %s  bvn=%s account_no=%s", url, bvn, account_no)
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(url, data=data, files=files, headers=_auth_headers())
    resp.raise_for_status()
    body = resp.json()
    logger.info("← %s %s overall_result=%s", resp.status_code, url, body.get("overall_result"))
    return body


async def liveness_start(
    *,
    customer_bvn: str,
    account_no: str,
    app_id: str = "",
) -> dict:
    """
    Call POST /api/kyc/liveness/start on the liveliness service.

    Returns the parsed JSON response (LivenessStartResponse shape).
    """
    url = f"{_LIVELINESS_BASE_URL}/api/kyc/liveness/start"
    payload = {
        "customer_bvn": customer_bvn,
        "account_no": account_no,
        "app_id": app_id,
    }
    logger.info("→ POST %s  customer_bvn=%s account_no=%s", url, customer_bvn, account_no)
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            url,
            data=payload,
            headers={**_auth_headers(), "Content-Type": "application/x-www-form-urlencoded"},
        )
    resp.raise_for_status()
    body = resp.json()
    logger.info("← %s %s session_id=%s", resp.status_code, url, body.get("session_id"))
    return body


async def liveness_verify(
    *,
    session_id: str,
    nonce: str,
    timestamps: str,
    frames: List[bytes],
) -> dict:
    """
    Call POST /api/kyc/liveness/verify on the liveliness service.

    Returns the parsed JSON response (MultiCaptureVerificationResponse shape).
    """
    url = f"{_LIVELINESS_BASE_URL}/api/kyc/liveness/verify"
    data: dict = {
        "session_id": session_id,
        "nonce": nonce,
        "timestamps": timestamps,
    }
    files: list = []
    for i, frame in enumerate(frames):
        files.append((f"frame_{i}", (f"frame_{i}.jpg", frame, "image/jpeg")))

    logger.info("→ POST %s  session_id=%s frames=%d", url, session_id, len(frames))
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(url, data=data, files=files, headers=_auth_headers())
    resp.raise_for_status()
    body = resp.json()
    logger.info("← %s %s overall_result=%s", resp.status_code, url, body.get("overall_result"))
    return body


async def warmup() -> dict:
    """Call POST /api/warmup on the liveliness service."""
    url = f"{_LIVELINESS_BASE_URL}/api/warmup"
    logger.info("→ POST %s", url)
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(url, headers=_auth_headers())
    resp.raise_for_status()
    return resp.json()


async def spoof_check(image: bytes) -> dict:
    """Call POST /api/spoof-check on the liveliness service."""
    url = f"{_LIVELINESS_BASE_URL}/api/spoof-check"
    files = {"image": ("image.jpg", image, "image/jpeg")}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(url, files=files, headers=_auth_headers())
    resp.raise_for_status()
    return resp.json()


async def face_verify(image1: bytes, image2: bytes) -> dict:
    """Call POST /api/face-verify on the liveliness service."""
    url = f"{_LIVELINESS_BASE_URL}/api/face-verify"
    files = {
        "image1": ("image1.jpg", image1, "image/jpeg"),
        "image2": ("image2.jpg", image2, "image/jpeg"),
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(url, files=files, headers=_auth_headers())
    resp.raise_for_status()
    return resp.json()
