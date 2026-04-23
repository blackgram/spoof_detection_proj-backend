"""
TOTP setup router.
Authenticates as Keycloak admin, ensures a Keycloak user exists for the customer,
registers TOTP via the Keycloak TOTP-registration extension, and returns the secret.
"""

import logging
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.db.firestore_client import FirestoreClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/totp", tags=["totp"])


class TotpSetupRequest(BaseModel):
    customer_id: str
    username: str
    issuer: str = "AccessMore"


class TotpSetupResponse(BaseModel):
    success: bool
    totp_secret: str
    qr_code_url: str
    manual_entry_key: str
    keycloak_user_id: str
    message: str


class TotpVerifyRequest(BaseModel):
    customer_id: str | None = None
    username: str
    totp_code: str


class TotpVerifyResponse(BaseModel):
    valid: bool
    message: str
    keycloak_user_id: str


async def _get_admin_token(settings) -> str:
    """Obtain a Keycloak admin access token via resource-owner password grant."""
    token_url = f"{settings.keycloak_base_url}/realms/master/protocol/openid-connect/token"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(token_url, data={
            "grant_type": "password",
            "client_id": settings.keycloak_admin_client_id,
            "username": settings.keycloak_admin_username,
            "password": settings.keycloak_admin_password,
        })
    if resp.status_code != 200:
        logger.error("Keycloak admin auth failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(status_code=502, detail="Keycloak admin authentication failed")
    return resp.json()["access_token"]


async def _find_or_create_keycloak_user(
    settings, token: str, username: str, customer_id: str
) -> str:
    """Return the Keycloak user UUID, creating the user if it doesn't exist."""
    realm = settings.keycloak_realm
    base = settings.keycloak_base_url
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=15) as client:
        search_resp = await client.get(
            f"{base}/admin/realms/{realm}/users",
            params={"username": username, "exact": "true"},
            headers=headers,
        )

    if search_resp.status_code == 200:
        users = search_resp.json()
        if users:
            uid = users[0]["id"]
            logger.info("Found existing Keycloak user %s (id=%s)", username, uid)
            return uid

    user_payload = {
        "username": username,
        "enabled": True,
        "attributes": {"customer_id": [customer_id]},
    }
    async with httpx.AsyncClient(timeout=15) as client:
        create_resp = await client.post(
            f"{base}/admin/realms/{realm}/users",
            json=user_payload,
            headers=headers,
        )

    if create_resp.status_code == 201:
        location = create_resp.headers.get("Location", "")
        uid = location.rstrip("/").rsplit("/", 1)[-1] if location else ""
        if uid:
            logger.info("Created Keycloak user %s (id=%s)", username, uid)
            return uid
        # Location header missing — look up the user we just created
        async with httpx.AsyncClient(timeout=15) as client:
            search_resp = await client.get(
                f"{base}/admin/realms/{realm}/users",
                params={"username": username, "exact": "true"},
                headers=headers,
            )
        if search_resp.status_code == 200 and search_resp.json():
            uid = search_resp.json()[0]["id"]
            logger.info("Created Keycloak user %s (id=%s via lookup)", username, uid)
            return uid

    if create_resp.status_code == 409:
        async with httpx.AsyncClient(timeout=15) as client:
            search_resp = await client.get(
                f"{base}/admin/realms/{realm}/users",
                params={"username": username, "exact": "true"},
                headers=headers,
            )
        if search_resp.status_code == 200 and search_resp.json():
            uid = search_resp.json()[0]["id"]
            logger.info("User %s already existed (id=%s)", username, uid)
            return uid

    logger.error("Failed to create Keycloak user: %s %s", create_resp.status_code, create_resp.text)
    raise HTTPException(status_code=502, detail="Failed to create Keycloak user")


async def _remove_existing_totp(settings, token: str, keycloak_user_id: str) -> bool:
    """Remove existing TOTP credentials for a Keycloak user. Returns True if removed."""
    realm = settings.keycloak_realm
    url = f"{settings.keycloak_base_url}/realms/{realm}/totp-registration/totp/{keycloak_user_id}"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(url, headers=headers)

    if resp.status_code in (200, 204):
        logger.info("Removed existing TOTP for user %s", keycloak_user_id)
        return True
    elif resp.status_code == 404:
        logger.info("No existing TOTP to remove for user %s", keycloak_user_id)
        return False
    else:
        logger.warning("TOTP removal returned %s: %s", resp.status_code, resp.text)
        return False


async def _register_totp(settings, token: str, keycloak_user_id: str, label: str) -> dict:
    """Register TOTP for a Keycloak user via the TOTP-registration extension."""
    realm = settings.keycloak_realm
    url = f"{settings.keycloak_base_url}/realms/{realm}/totp-registration/totp/register"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json={
            "userId": keycloak_user_id,
            "userLabel": label,
        }, headers=headers)

    if resp.status_code != 200:
        logger.error("TOTP register failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(status_code=502, detail="TOTP registration on Keycloak failed")

    return resp.json()


async def _verify_totp(settings, token: str, keycloak_user_id: str, totp_code: str) -> dict:
    """Verify a TOTP code for a Keycloak user via the TOTP-registration extension."""
    realm = settings.keycloak_realm
    url = f"{settings.keycloak_base_url}/realms/{realm}/totp-registration/totp/verify"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json={
            "userId": keycloak_user_id,
            "totpCode": totp_code,
        }, headers=headers)

    if resp.status_code != 200:
        logger.error("TOTP verify failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(status_code=502, detail="TOTP verification on Keycloak failed")

    return resp.json()


@router.post("/setup", response_model=TotpSetupResponse)
async def setup_totp(body: TotpSetupRequest):
    """
    Full TOTP provisioning flow:
    1. Ensure customer exists (create if needed)
    2. Authenticate as Keycloak admin
    3. Create (or find) a Keycloak user for this customer
    4. Register TOTP via the extension
    5. Return the secret so the mobile app can generate codes
    """
    settings = get_settings()

    db = FirestoreClient()
    # Ensure the customer exists, creating if necessary
    customer_id, created = db.ensure_customer_for_username(body.username)
    logger.info("Customer %s for username %s (created=%s)", customer_id, body.username, created)

    token = await _get_admin_token(settings)

    kc_user_id = await _find_or_create_keycloak_user(
        settings, token, body.username, customer_id
    )

    # Remove existing TOTP if any (allows re-setup without manual Keycloak cleanup)
    await _remove_existing_totp(settings, token, kc_user_id)

    label = f"{body.issuer} ({body.username})"
    totp_data = await _register_totp(
        settings, token, kc_user_id, label
    )

    # Override Keycloak's qr_code_url with the correct issuer
    secret = totp_data.get("totpSecret", "") or totp_data.get("manualEntryKey", "")
    from urllib.parse import quote
    issuer_encoded = quote(body.issuer)
    username_encoded = quote(body.username)
    qr_code_url = (
        f"otpauth://totp/{issuer_encoded}:{username_encoded}"
        f"?secret={secret}&issuer={issuer_encoded}&algorithm=SHA1&digits=6&period=30"
    )

    logger.info(
        "TOTP registered for user %s: secret=%s..., issuer=%s",
        body.username,
        secret[:8] if secret else "(empty)",
        body.issuer,
    )

    return TotpSetupResponse(
        success=True,
        totp_secret=secret,
        qr_code_url=qr_code_url,
        manual_entry_key=totp_data.get("manualEntryKey", ""),
        keycloak_user_id=kc_user_id,
        message="TOTP registered successfully",
    )


@router.post("/verify", response_model=TotpVerifyResponse)
async def verify_totp(body: TotpVerifyRequest):
    """
    Verify a customer TOTP code in Keycloak.
    Looks up the Keycloak user by username — customer_id is optional.
    """
    settings = get_settings()

    token = await _get_admin_token(settings)

    # Find the Keycloak user by username (no need to create — must already exist from setup)
    realm = settings.keycloak_realm
    base = settings.keycloak_base_url
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=15) as client:
        search_resp = await client.get(
            f"{base}/admin/realms/{realm}/users",
            params={"username": body.username, "exact": "true"},
            headers=headers,
        )

    if search_resp.status_code != 200 or not search_resp.json():
        logger.error("Keycloak user not found for username: %s", body.username)
        return TotpVerifyResponse(
            valid=False,
            message="User not found. Please set up TOTP first.",
            keycloak_user_id="",
        )

    kc_user_id = search_resp.json()[0]["id"]
    logger.info("Verifying TOTP for user %s (kc_id=%s)", body.username, kc_user_id)

    verify_data = await _verify_totp(settings, token, kc_user_id, body.totp_code.strip())
    valid = bool(verify_data.get("valid"))
    message = verify_data.get("message") or ("TOTP is valid" if valid else "Invalid TOTP code")
    return TotpVerifyResponse(
        valid=valid,
        message=message,
        keycloak_user_id=kc_user_id,
    )
