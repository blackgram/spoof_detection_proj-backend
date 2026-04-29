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
from typing import Optional

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


async def fetch_account_image(account_no: str) -> Optional[bytes]:
    """
    Call the Access Bank AccountImageCollection endpoint and return the
    account_image as raw bytes (decoded from base64).

    Returns None when:
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
            return None

        data = resp.json()
        rc = data.get("response_code")
        if rc != "00":
            logger.warning(
                "AccountImageCollection response_code=%s message=%s for account_no=%s",
                rc, data.get("response_message"), masked_account,
            )
            return None

        records = data.get("AccountImageCollectionResponse") or []
        if not records:
            logger.warning("AccountImageCollection returned empty list for account_no=%s", masked_account)
            return None

        b64 = (records[0].get("account_image") or "").strip()
        if not b64:
            logger.warning("account_image field empty for account_no=%s", masked_account)
            return None

        image_bytes = base64.b64decode(b64)
        logger.info(
            "Fetched account image for account_no=%s — %d bytes (from %s)",
            masked_account, len(image_bytes), data.get("AccountImageCollectionResponse", [{}])[0].get("account_name", "?"),
        )
        return image_bytes

    except Exception as exc:
        logger.warning(
            "AccountImageCollection call failed for account_no=%s: %s",
            masked_account, exc,
        )
        return None
