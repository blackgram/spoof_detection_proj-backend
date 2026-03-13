"""
Device-bound key + local biometrics (no passkeys).
- Register: store Ed25519 public key per customer.
- Challenge/verify: one-time challenge, client signs after biometrics; server verifies.
- Transaction: same state_id flow as FIDO2; transfer endpoint consumes state_id.
"""

import base64
import hashlib
import logging
import secrets
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.firestore_client import FirestoreClient
from app.routers.fido2 import set_transaction_authorized, store_transaction_state

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/device-auth", tags=["device-auth"])
db = FirestoreClient()

# One-time login challenges: customer_id -> { "challenge_raw_b64", "challenge_bytes" } (clear after verify or TTL)
_challenge_store: dict[str, dict[str, Any]] = {}

# Ed25519: public key 32 bytes, signature 64 bytes
CHALLENGE_BYTES = 32


def _b64_decode(s: str) -> bytes:
    """Decode base64 (standard or url-safe)."""
    pad = 4 - len(s) % 4
    if pad != 4:
        s += "=" * pad
    try:
        return base64.urlsafe_b64decode(s)
    except Exception:
        return base64.b64decode(s)


def _b64_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _verify_ed25519(public_key_b64: str, message: bytes, signature_b64: str) -> bool:
    try:
        from cryptography.exceptions import InvalidSignature
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

        pk_bytes = _b64_decode(public_key_b64)
        sig_bytes = _b64_decode(signature_b64)
        if len(pk_bytes) != 32 or len(sig_bytes) != 64:
            return False
        key = Ed25519PublicKey.from_public_bytes(pk_bytes)
        key.verify(sig_bytes, message)
        return True
    except InvalidSignature:
        return False
    except Exception as e:
        logger.warning("Ed25519 verify error: %s", e)
        return False


# --- Request/response models ---


class RegisterBody(BaseModel):
    customer_id: str
    public_key: str  # base64 Ed25519 public key (32 bytes)


class ChallengeBody(BaseModel):
    customer_id: str


class VerifyBody(BaseModel):
    customer_id: str
    challenge: str  # base64 challenge from /challenge
    signature: str  # base64 Ed25519 signature (64 bytes)
    device_name: str | None = None  # e.g. "iPhone 17 Pro Max"


class TransactionChallengeBody(BaseModel):
    customer_id: str
    amount_ngn: float
    beneficiary_account_number: str


class TransactionVerifyBody(BaseModel):
    state_id: str
    signature: str  # base64 Ed25519 signature of the transaction challenge (hash) the client received
    device_name: str | None = None  # e.g. "iPhone 17 Pro Max"


# --- Endpoints ---


@router.post("/register")
async def register(body: RegisterBody):
    """Store device public key for a customer (one key per customer). Used after KYC when enabling biometrics."""
    logger.info("[device-auth] register request: customer_id=%s public_key_len=%d", body.customer_id, len(body.public_key or ""))
    pk_b64 = body.public_key.strip()
    try:
        pk_bytes = _b64_decode(pk_b64)
        if len(pk_bytes) != 32:
            raise HTTPException(status_code=400, detail="Invalid public key: expected 32 bytes (Ed25519)")
    except Exception as e:
        logger.warning("[device-auth] register invalid key: %s", e)
        raise HTTPException(status_code=400, detail=f"Invalid public key encoding: {e}")
    db.set_device_public_key(body.customer_id, pk_b64, algorithm="ed25519")
    out = {"registered": True, "customer_id": body.customer_id}
    logger.info("[device-auth] register response: %s", out)
    return out


@router.post("/challenge")
async def challenge(body: ChallengeBody):
    """Return a one-time challenge for the client to sign (after local biometrics). Used for login."""
    logger.info("[device-auth] challenge request: customer_id=%s", body.customer_id)
    key_doc = db.get_device_public_key(body.customer_id)
    if not key_doc:
        logger.warning("[device-auth] challenge: no device key for customer_id=%s", body.customer_id)
        raise HTTPException(status_code=400, detail="No device key registered for this customer")
    challenge_bytes = secrets.token_bytes(CHALLENGE_BYTES)
    challenge_b64 = _b64_encode(challenge_bytes)
    _challenge_store[body.customer_id] = {"challenge_raw_b64": challenge_b64, "challenge_bytes": challenge_bytes}
    out = {"challenge": challenge_b64}
    logger.info("[device-auth] challenge response: challenge_len=%d", len(challenge_b64))
    return out


@router.post("/verify")
async def verify(body: VerifyBody):
    """Verify Ed25519 signature over the challenge. Returns verified=true for login success."""
    logger.info(
        "[device-auth] verify request: customer_id=%s challenge_len=%d signature_len=%d",
        body.customer_id, len(body.challenge or ""), len(body.signature or ""),
    )
    if body.customer_id not in _challenge_store:
        logger.warning("[device-auth] verify: no challenge for customer_id=%s", body.customer_id)
        raise HTTPException(status_code=400, detail="No challenge for this customer or challenge expired")
    key_doc = db.get_device_public_key(body.customer_id)
    if not key_doc:
        _challenge_store.pop(body.customer_id, None)
        raise HTTPException(status_code=400, detail="No device key registered")
    stored = _challenge_store.pop(body.customer_id)
    message = stored["challenge_bytes"]
    if not _verify_ed25519(key_doc["public_key_b64"], message, body.signature):
        logger.warning("[device-auth] verify: signature verification failed for customer_id=%s", body.customer_id)
        raise HTTPException(status_code=401, detail="Signature verification failed")
    try:
        db.add_device_auth_event(
            customer_id=body.customer_id,
            event_type="login",
            challenge_b64=body.challenge,
            signature_b64=body.signature,
            device_name=body.device_name,
        )
    except Exception as e:
        logger.warning("[device-auth] verify: failed to save event: %s", e)
    out = {"verified": True, "customer_id": body.customer_id}
    logger.info("[device-auth] verify response: %s", out)
    return out


@router.post("/transaction-challenge")
async def transaction_challenge(body: TransactionChallengeBody):
    """Create a transaction signing challenge and state_id. Client signs challenge after biometrics; then call transaction-verify and transfer."""
    logger.info(
        "[device-auth] transaction-challenge request: customer_id=%s amount_ngn=%s beneficiary=%s",
        body.customer_id, body.amount_ngn, body.beneficiary_account_number,
    )
    key_doc = db.get_device_public_key(body.customer_id)
    if not key_doc:
        logger.warning("[device-auth] transaction-challenge: no device key for customer_id=%s", body.customer_id)
        raise HTTPException(status_code=400, detail="No device key registered for this customer")
    nonce = secrets.token_hex(16)
    ts = str(uuid.uuid4())
    challenge_raw = f"{body.amount_ngn}|{body.beneficiary_account_number}|{nonce}|{ts}"
    challenge_hash = hashlib.sha256(challenge_raw.encode()).digest()
    state_id = secrets.token_urlsafe(24)
    pending = {
        "customer_id": body.customer_id,
        "amount_ngn": body.amount_ngn,
        "beneficiary_account_number": body.beneficiary_account_number,
        "challenge": challenge_hash,
        "nonce": nonce,
        "transaction_hash": challenge_raw,
    }
    store_transaction_state(state_id, pending)
    out = {
        "state_id": state_id,
        "challenge": _b64_encode(challenge_hash),
        "nonce": nonce,
    }
    logger.info("[device-auth] transaction-challenge response: state_id=%s challenge_len=%d nonce=%s", state_id, len(out["challenge"]), nonce)
    return out


@router.post("/transaction-verify")
async def transaction_verify(body: TransactionVerifyBody):
    """Verify Ed25519 signature for the transaction. Marks state_id authorized; client then calls POST /api/transactions/transfer with state_id."""
    from app.routers.fido2 import get_pending_transaction

    logger.info(
        "[device-auth] transaction-verify request: state_id=%s signature_len=%d",
        body.state_id, len(body.signature or ""),
    )
    pending = get_pending_transaction(body.state_id)
    if not pending:
        logger.warning("[device-auth] transaction-verify: no pending state_id=%s", body.state_id)
        raise HTTPException(status_code=400, detail="Invalid or expired state_id; call transaction-challenge again")
    customer_id = pending["customer_id"]
    key_doc = db.get_device_public_key(customer_id)
    if not key_doc:
        raise HTTPException(status_code=400, detail="No device key registered")
    message = pending["challenge"]  # bytes (sha256 hash)
    if not _verify_ed25519(key_doc["public_key_b64"], message, body.signature):
        logger.warning("[device-auth] transaction-verify: signature failed state_id=%s", body.state_id)
        raise HTTPException(status_code=401, detail="Transaction signature verification failed")
    challenge_b64 = _b64_encode(pending["challenge"])
    try:
        db.add_device_auth_event(
            customer_id=customer_id,
            event_type="transaction",
            challenge_b64=challenge_b64,
            signature_b64=body.signature,
            device_name=body.device_name,
            amount_ngn=pending.get("amount_ngn"),
            beneficiary_account_number=pending.get("beneficiary_account_number"),
            state_id=body.state_id,
        )
    except Exception as e:
        logger.warning("[device-auth] transaction-verify: failed to save event: %s", e)
    set_transaction_authorized(body.state_id)
    out = {
        "authorized": True,
        "state_id": body.state_id,
        "message": "Call POST /api/transactions/transfer with state_id in body to execute transfer.",
    }
    logger.info("[device-auth] transaction-verify response: %s", out)
    return out
