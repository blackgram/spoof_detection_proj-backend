"""
FIDO2 / Passkey authentication and transaction authorization.

- Registration: device creates key pair, public key stored on server.
- Login: server sends challenge, device signs with private key (unlocked by biometric).
- Transaction: server sends transaction hash as challenge, device signs; server verifies then executes transfer.

KYC flow remains for limits and device registration; this flow is for auth and transaction authorization.
"""

import base64
import hashlib
import logging
import os
import secrets
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.db.firestore_client import FirestoreClient
from app.models.fido2 import (
    Fido2AuthenticateCompleteBody,
    Fido2CustomerBody,
    Fido2RegisterCompleteBody,
    Fido2TransactionAuthorizeBody,
    Fido2TransactionInitiateBody,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/fido2", tags=["fido2"])
db = FirestoreClient()

# In-memory session state (in production use Redis or signed cookies)
_registration_state: dict[str, Any] = {}
_auth_state: dict[str, Any] = {}
_transaction_state: dict[str, dict[str, Any]] = {}


def consume_authorized_transaction(state_id: str) -> dict[str, Any] | None:
    """
    If state_id exists and is authorized, return the pending transaction dict and remove it.
    Used by POST /api/transactions/transfer when client sends state_id (FIDO2 or device-auth flow).
    """
    if state_id not in _transaction_state:
        return None
    pending = _transaction_state[state_id]
    if not pending.get("authorized"):
        return None
    del _transaction_state[state_id]
    return pending


def store_transaction_state(state_id: str, pending: dict[str, Any]) -> None:
    """Store pending transaction state (used by device-auth transaction-challenge)."""
    _transaction_state[state_id] = pending


def set_transaction_authorized(state_id: str) -> None:
    """Mark a pending transaction as authorized (used by device-auth transaction-verify)."""
    if state_id in _transaction_state:
        _transaction_state[state_id]["authorized"] = True


def get_pending_transaction(state_id: str) -> dict[str, Any] | None:
    """Return pending transaction dict for state_id, or None (used by device-auth)."""
    return _transaction_state.get(state_id)


def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    if pad != 4:
        s += "=" * pad
    return base64.urlsafe_b64decode(s)


def _get_fido2_server():
    try:
        from fido2.server import Fido2Server
        from fido2.webauthn import PublicKeyCredentialRpEntity
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"FIDO2 not available: {e}. Install with: pip install fido2")
    settings = get_settings()
    rp = PublicKeyCredentialRpEntity(id=settings.fido2_rp_id, name=settings.fido2_rp_name)
    if settings.fido2_allow_any_origin:
        # Dev-only: bypass strict origin checking so we can test from mobile apps
        # even when origins (android:apk-key-hash:..., https://ngrok-host, etc.)
        # don't exactly match the rp.id / expected origin.
        def _allow_any_origin(origin: str) -> bool:  # type: ignore[override]
            logger.warning("FIDO2 dev mode: accepting origin %s", origin)
            return True

        return Fido2Server(rp, verify_origin=_allow_any_origin)
    return Fido2Server(rp)


def _get_opt(options: Any, key: str) -> Any:
    """Get value from options (dict-like or object). Supports both camelCase and snake_case."""
    if hasattr(options, "get") and callable(getattr(options, "get")):
        val = options.get(key)
        if val is not None:
            return val
        # try snake_case / camelCase variants
        if key == "pub_key_cred_params":
            return options.get("pubKeyCredParams")
        if key == "exclude_credentials":
            return options.get("excludeCredentials")
        if key == "allow_credentials":
            return options.get("allowCredentials")
        if key == "authenticator_selection":
            return options.get("authenticatorSelection")
        return None
    return getattr(options, key, None) or getattr(options, "pubKeyCredParams" if key == "pub_key_cred_params" else key, None)


def _webauthn_options_to_client(
    options: Any,
    *,
    omit_allow_credentials: bool = False,
    credential_id_client_map: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Convert server options to JSON-friendly dict with base64url binary fields.
    python-fido2 returns CredentialCreationOptions/CredentialRequestOptions with a nested 'publicKey' dict.
    Set omit_allow_credentials=True for assertion (login) so the device can use any passkey for this rpId
    and avoid 'sign in from another device' when credential ID format differs on Android."""
    # Unwrap: library returns { "publicKey": { "challenge", "rp", "user", ... } }
    inner = options
    if hasattr(options, "get") and options.get("publicKey") is not None:
        inner = options["publicKey"]
    out: dict[str, Any] = {}

    challenge = _get_opt(inner, "challenge")
    if challenge is not None:
        out["challenge"] = _b64url_encode(challenge) if isinstance(challenge, bytes) else challenge

    rp = _get_opt(inner, "rp")
    if rp is not None:
        if hasattr(rp, "id"):
            out["rp"] = {"id": rp.id, "name": getattr(rp, "name", "")}
        elif isinstance(rp, dict):
            out["rp"] = {"id": rp.get("id"), "name": rp.get("name", "")}

    rp_id = _get_opt(inner, "rpId") or (inner.get("rpId") if hasattr(inner, "get") else None)
    if rp_id is not None:
        out["rpId"] = rp_id

    user = _get_opt(inner, "user")
    if user is not None:
        if isinstance(user, dict):
            uid = user.get("id")
            out["user"] = {**user, "id": _b64url_encode(uid) if isinstance(uid, bytes) else uid}
        else:
            uid = getattr(user, "id", None)
            out["user"] = {"id": _b64url_encode(uid) if isinstance(uid, bytes) else uid, "name": getattr(user, "name", ""), "displayName": getattr(user, "display_name", "") or getattr(user, "displayName", "")}

    excl = _get_opt(inner, "exclude_credentials") or (inner.get("excludeCredentials") if hasattr(inner, "get") else None)
    if excl and isinstance(excl, list):
        out["exclude_credentials"] = []
        for c in excl:
            cid = c.get("id") if isinstance(c, dict) else getattr(c, "id", None)
            if cid is not None:
                out["exclude_credentials"].append({"type": "public-key", "id": _b64url_encode(cid) if isinstance(cid, bytes) else cid})
            else:
                out["exclude_credentials"].append(c)

    if not omit_allow_credentials:
        allow = _get_opt(inner, "allow_credentials") or (inner.get("allowCredentials") if hasattr(inner, "get") else None)
        id_client_map = credential_id_client_map or {}
        if allow and isinstance(allow, list):
            out["allow_credentials"] = []
            for c in allow:
                cid = c.get("id") if isinstance(c, dict) else getattr(c, "id", None)
                if cid is not None:
                    # Use client's exact rawId when stored so Android finds the credential (avoids NoCredentials)
                    if isinstance(cid, bytes):
                        key_b64 = base64.standard_b64encode(cid).decode("ascii")
                        id_str = id_client_map.get(key_b64) or _b64url_encode(cid)
                    else:
                        id_str = id_client_map.get(str(cid)) or cid
                    entry: dict[str, Any] = {"type": "public-key", "id": id_str, "transports": ["internal"]}
                    out["allow_credentials"].append(entry)
                else:
                    out["allow_credentials"].append(c)

    pub_key_cred_params = _get_opt(inner, "pub_key_cred_params") or _get_opt(inner, "pubKeyCredParams")
    if pub_key_cred_params:
        out["pub_key_cred_params"] = pub_key_cred_params

    timeout = _get_opt(inner, "timeout")
    if timeout is not None:
        out["timeout"] = timeout

    auth_sel = _get_opt(inner, "authenticator_selection") or _get_opt(inner, "authenticatorSelection")
    if auth_sel is not None:
        out["authenticatorSelection"] = auth_sel if isinstance(auth_sel, dict) else {"userVerification": "required"}

    return out


def _load_credentials_for_customer(customer_id: str) -> list:
    """Load AttestedCredentialData list from DB for use with fido2 server."""
    try:
        from fido2.webauthn import AttestedCredentialData
    except ImportError:
        return []
    rows = db.get_fido2_credentials(customer_id)
    creds = []
    for row in rows:
        cdata_b64 = row.get("credential_data_b64")
        if not cdata_b64:
            continue
        try:
            data = base64.standard_b64decode(cdata_b64)
            att_cred, _ = AttestedCredentialData.unpack_from(data)
            creds.append(att_cred)
        except Exception as e:
            logger.warning("Skip invalid credential for %s: %s", customer_id, e)
    return creds


# --- Registration ---


@router.post("/register/begin")
async def register_begin(body: Fido2CustomerBody):
    """
    Start FIDO2 credential registration. Client uses returned options to create a credential
    (device generates key pair, stores private key in Secure Enclave / TEE).
    """
    customer_id = body.customer_id
    cust = db.get_customer_by_id(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    server = _get_fido2_server()
    user_id = os.urandom(16)
    user = {"id": user_id, "name": customer_id, "displayName": cust.get("name") or customer_id}
    existing = _load_credentials_for_customer(customer_id)
    try:
        registration_data, state = server.register_begin(
            user,
            credentials=existing,
            user_verification="required",
        )
    except Exception as e:
        logger.exception("register_begin failed")
        raise HTTPException(status_code=400, detail=str(e))
    _registration_state[customer_id] = {"state": state, "user_id": user_id}
    return _webauthn_options_to_client(registration_data)


@router.post("/register/complete/{customer_id}")
async def register_complete(customer_id: str, body: Fido2RegisterCompleteBody):
    """
    Complete registration: verify attestation and store credential.
    """
    if customer_id not in _registration_state:
        raise HTTPException(status_code=400, detail="No registration in progress; call register/begin first")
    server = _get_fido2_server()
    state = _registration_state[customer_id]["state"]
    try:
        from fido2.webauthn import AttestedCredentialData
        # Client sends PublicKeyCredential: { id, rawId, response: { clientDataJSON, attestationObject }, type }
        cred = body.credential
        response = cred.get("response") or {}
        client_data_json = response.get("clientDataJSON")
        attestation_obj = response.get("attestationObject")
        if not client_data_json or not attestation_obj:
            raise HTTPException(status_code=400, detail="Missing clientDataJSON or attestationObject")
        # Pass full WebAuthn-style response mapping to python-fido2.
        # Fido2Server.register_complete(state, response) expects a RegistrationResponse-like Mapping.
        auth_data = server.register_complete(state, cred)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("register_complete failed")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        _registration_state.pop(customer_id, None)

    credential_id_bytes = auth_data.credential_data.credential_id
    credential_data_bytes = bytes(auth_data.credential_data)
    credential_id_b64 = base64.standard_b64encode(credential_id_bytes).decode("ascii")
    credential_data_b64 = base64.standard_b64encode(credential_data_bytes).decode("ascii")
    # Store client's exact rawId so we can send it in allowCredentials (Android matches on this)
    raw_id_from_client = cred.get("rawId") or cred.get("id")
    raw_id_from_client = raw_id_from_client if isinstance(raw_id_from_client, str) else None
    db.add_fido2_credential(
        customer_id=customer_id,
        credential_id_b64=credential_id_b64,
        credential_data_b64=credential_data_b64,
        sign_count=0,
        credential_id_client=raw_id_from_client,
    )
    return {"status": "ok", "credential_id": _b64url_encode(credential_id_bytes)}


# --- Authentication (login) ---


@router.post("/authenticate/begin")
async def authenticate_begin(body: Fido2CustomerBody):
    """Start FIDO2 authentication. Returns challenge options for getAssertion."""
    customer_id = body.customer_id
    creds = _load_credentials_for_customer(customer_id)
    if not creds:
        raise HTTPException(status_code=400, detail="No passkey registered; complete registration first")
    server = _get_fido2_server()
    try:
        auth_data, state = server.authenticate_begin(creds, user_verification="required")
    except Exception as e:
        logger.exception("authenticate_begin failed")
        raise HTTPException(status_code=400, detail=str(e))
    _auth_state[customer_id] = {"state": state, "credentials": creds}
    # Build map: credential_id_b64 -> client rawId so allowCredentials uses exact ID device expects
    rows = db.get_fido2_credentials(customer_id)
    id_client_map = {r["credential_id_b64"]: r["credential_id_client"] for r in rows if r.get("credential_id_client")}
    return _webauthn_options_to_client(
        auth_data, omit_allow_credentials=False, credential_id_client_map=id_client_map
    )


@router.post("/authenticate/complete/{customer_id}")
async def authenticate_complete(customer_id: str, body: Fido2AuthenticateCompleteBody):
    """Complete login: verify assertion."""
    if customer_id not in _auth_state:
        raise HTTPException(status_code=400, detail="No authentication in progress; call authenticate/begin first")
    server = _get_fido2_server()
    stored = _auth_state[customer_id]
    state = stored["state"]
    creds = stored["credentials"]
    try:
        assertion = body.assertion
        # Client sends assertion with authenticatorData, clientDataJSON, signature, etc.
        credential_id = assertion.get("credentialId") or assertion.get("rawId")
        if isinstance(credential_id, str):
            credential_id = _b64url_decode(credential_id)
        client_data = assertion.get("clientDataJSON")
        if isinstance(client_data, str):
            client_data = _b64url_decode(client_data)
        auth_data = assertion.get("authenticatorData")
        if isinstance(auth_data, str):
            auth_data = _b64url_decode(auth_data)
        signature = assertion.get("signature")
        if isinstance(signature, str):
            signature = _b64url_decode(signature)
        server.authenticate_complete(state, creds, credential_id, client_data, auth_data, signature)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("authenticate_complete failed")
        raise HTTPException(status_code=401, detail=str(e))
    finally:
        _auth_state.pop(customer_id, None)
    return {"authenticated": True}


# --- Transaction authorization ---


@router.post("/transaction/initiate")
async def transaction_initiate(body: Fido2TransactionInitiateBody):
    """
    Get a transaction signing challenge. Client signs this with passkey; then call
    POST /api/transactions/transfer with the assertion (or use transaction/authorize + transfer).
    """
    customer_id = body.customer_id
    cust = db.get_customer_by_id(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    creds = _load_credentials_for_customer(customer_id)
    if not creds:
        raise HTTPException(status_code=400, detail="No passkey registered; complete FIDO2 registration first")
    nonce = secrets.token_hex(16)
    ts = str(uuid.uuid4())
    challenge_raw = f"{body.amount_ngn}|{body.beneficiary_account_number}|{nonce}|{ts}"
    challenge = hashlib.sha256(challenge_raw.encode()).digest()
    state_id = secrets.token_urlsafe(24)
    _transaction_state[state_id] = {
        "customer_id": customer_id,
        "amount_ngn": body.amount_ngn,
        "beneficiary_account_number": body.beneficiary_account_number,
        "challenge": challenge,
        "nonce": nonce,
        "transaction_hash": challenge_raw,
    }
    return {
        "state_id": state_id,
        "challenge": _b64url_encode(challenge),
        "nonce": nonce,
    }


@router.post("/transaction/authorize")
async def transaction_authorize(body: Fido2TransactionAuthorizeBody):
    """
    Verify FIDO2 assertion for a pending transaction. If valid, returns an authorization token
    that the client can send to POST /api/transactions/transfer, or we could execute transfer here.
    This endpoint verifies the signature and returns success; the client then calls transfer with
    the same params and includes the verified assertion in the audit payload.
    """
    state_id = body.state_id
    if state_id not in _transaction_state:
        raise HTTPException(status_code=400, detail="Invalid or expired state_id; call transaction/initiate again")
    pending = _transaction_state[state_id]
    if (
        pending["customer_id"] != body.sender_customer_id
        or pending["amount_ngn"] != body.amount_ngn
        or pending["beneficiary_account_number"] != body.beneficiary_account_number
    ):
        raise HTTPException(status_code=400, detail="Transaction params do not match initiate")
    challenge = pending["challenge"]
    # Verify assertion: client signed the challenge with their passkey
    server = _get_fido2_server()
    creds = _load_credentials_for_customer(body.sender_customer_id)
    if not creds:
        raise HTTPException(status_code=400, detail="No credentials")
    try:
        assertion = body.assertion
        credential_id = assertion.get("credentialId") or assertion.get("rawId")
        if isinstance(credential_id, str):
            credential_id = _b64url_decode(credential_id)
        client_data = assertion.get("clientDataJSON")
        if isinstance(client_data, str):
            client_data = _b64url_decode(client_data)
        auth_data = assertion.get("authenticatorData")
        if isinstance(auth_data, str):
            auth_data = _b64url_decode(auth_data)
        signature = assertion.get("signature")
        if isinstance(signature, str):
            signature = _b64url_decode(signature)
        # We need to run authenticate_begin to get state, then authenticate_complete with the assertion
        auth_options, state = server.authenticate_begin(creds, user_verification="required")
        server.authenticate_complete(state, creds, credential_id, client_data, auth_data, signature)
    except Exception as e:
        logger.exception("transaction_authorize verify failed")
        raise HTTPException(status_code=401, detail=f"Assertion verification failed: {e}")

    pending["authorized"] = True
    return {
        "authorized": True,
        "state_id": state_id,
        "message": "Call POST /api/transactions/transfer with state_id in body to execute transfer.",
    }
