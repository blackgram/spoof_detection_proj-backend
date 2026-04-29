"""
Access Bank AccountImageCollection API client.

Fetches the customer's passport/account photo from the bank's core system.
This image is used as the authoritative reference for face verification —
the bank holds the ground-truth photo taken at account opening.

Environment variables:
    ACCESS_BANK_EFM_URL        Base URL (default: https://api.dev.accessbankplc.com/efm/v1)
    ACCESS_BANK_EFM_AUTH_TOKEN Bearer / API-key value for the Authorization header
                               (default: the dev token below)

The response schema we consume:
    {
        "AccountImageCollectionResponse": [
            {
                "account_image":   "<base64 JPEG>",
                "customer_no":     "010558289",
                "account_no":      "0738040116",
                "account_name":    "AJIRIOGHNE TOCHUKU OKPEVA",
                "signature_image": "<base64 JPEG>",
                "operating_instruction": ""
            }
        ],
        "response_code": "00",
        "response_message": "Successful"
    }
"""

from __future__ import annotations

import base64
import logging
import os
from typing import List, Optional

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_BASE_URL = "https://api.dev.accessbankplc.com/efm/v1"
_DEFAULT_AUTH_TOKEN = "1051a77fb49f4524ac505d4087b83de5"
_CHANNEL_CODE = "ussd"
_REQUEST_TIMEOUT_S = 15.0


def _mask_account_no(account_no: str) -> str:
    s = (account_no or "").strip()
    if len(s) <= 4:
        return "****"
    return f"{'*' * (len(s) - 4)}{s[-4:]}"


def _base_url() -> str:
    return os.environ.get("ACCESS_BANK_EFM_URL", _DEFAULT_BASE_URL).rstrip("/")


def _auth_token() -> str:
    return os.environ.get("ACCESS_BANK_EFM_AUTH_TOKEN", _DEFAULT_AUTH_TOKEN)


async def fetch_account_images(account_no: str) -> List[bytes]:
    """
    Call the Access Bank AccountImageCollection endpoint and return all
    available account_image values as raw bytes (decoded from base64).

    Returns [] when:
    - response_code != "00"
    - AccountImageCollectionResponse list is empty
    - account_image field is absent or empty
    - Any network / HTTP error (logged as warning, caller falls back)

    Raises nothing — all errors are swallowed and logged so the caller
    can gracefully fall back to the stored Firestore reference image.
    """
    base_url = _base_url()
    url = f"{base_url}/enquiry/AccountImageCollection"
    payload = {"channel_code": _CHANNEL_CODE, "account_no": account_no}
    headers = {
        "Authorization": _auth_token(),
        "Content-Type": "application/json",
    }

    masked_account = _mask_account_no(account_no)
    logger.info(
        "AccountImageCollection request started account_no=%s base_url=%s timeout_s=%.1f",
        masked_account,
        base_url,
        _REQUEST_TIMEOUT_S,
    )
    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_S) as client:
            resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code != 200:
            logger.warning(
                "AccountImageCollection HTTP %d for account_no=%s: %s",
                resp.status_code, masked_account, resp.text[:300],
            )
            return []

        data = resp.json()
        rc = data.get("response_code")
        if rc != "00":
            logger.warning(
                "AccountImageCollection response_code=%s message=%s for account_no=%s",
                rc, data.get("response_message"), masked_account,
            )
            return []

        records = data.get("AccountImageCollectionResponse") or []
        if not records:
            logger.warning("AccountImageCollection returned empty list for account_no=%s", masked_account)
            return []

        images: List[bytes] = []
        for idx, rec in enumerate(records):
            b64 = (rec.get("account_image") or "").strip()
            if not b64:
                logger.info(
                    "AccountImageCollection item idx=%d has no account_image for account_no=%s",
                    idx,
                    masked_account,
                )
                continue
            try:
                images.append(base64.b64decode(b64))
            except Exception as e:
                logger.warning(
                    "Failed to decode account_image idx=%d for account_no=%s: %s",
                    idx,
                    masked_account,
                    e,
                )

        if not images:
            logger.warning("No decodable account_image entries for account_no=%s", masked_account)
            return []

        logger.info(
            "Fetched %d account image(s) for account_no=%s",
            len(images),
            masked_account,
        )
        return images

    except Exception as exc:
        logger.warning(
            "AccountImageCollection call failed for account_no=%s: %s",
            masked_account, exc,
        )
        return []


async def fetch_account_image(account_no: str) -> Optional[bytes]:
    """
    Backward-compatible helper: return the first image from AccountImageCollection.
    Prefer fetch_account_images() for multi-record matching.
    """
    images = await fetch_account_images(account_no)
    return images[0] if images else None
