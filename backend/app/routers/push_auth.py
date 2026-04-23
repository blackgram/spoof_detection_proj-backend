"""
Push authorization router.
External channels create authorization requests; backend stores them, sends Expo push,
and exposes endpoints for the app to list pending requests, get details, and respond.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.firestore_client import FirestoreClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/push-auth", tags=["push-auth"])

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class AuthRequestCreate(BaseModel):
    customer_id: str
    request_type: Literal["login", "transfer", "consent"]
    channel: str
    details: dict
    expires_in_seconds: int = 300


class AuthRequestResponse(BaseModel):
    request_id: str
    status: str
    request_type: str
    channel: str
    details: dict
    created_at: str
    expires_at: str
    push_sent: bool = False  # True if a push was sent to the device


class AuthRespondBody(BaseModel):
    request_id: str
    customer_id: str
    action: Literal["approve", "reject"]


class RegisterTokenBody(BaseModel):
    customer_id: str
    expo_push_token: str


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


async def _send_expo_push(expo_push_token: str, title: str, body: str, data: dict) -> bool:
    """Send a push notification via Expo's push API. Returns True if sent successfully."""
    if not expo_push_token or not expo_push_token.strip():
        logger.warning("No Expo push token; skipping push send")
        return False
    payload = {
        "to": expo_push_token.strip(),
        "title": title,
        "body": body,
        "data": data,
        "sound": "default",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(EXPO_PUSH_URL, json=payload)
        if resp.status_code != 200:
            logger.warning("Expo push failed: %s %s", resp.status_code, resp.text)
            return False
        logger.info("Expo push sent to %s", expo_push_token[:50])
        return True
    except Exception as e:
        logger.warning("Expo push error: %s", e)
        return False


@router.post("/request", response_model=AuthRequestResponse)
async def create_auth_request(body: AuthRequestCreate):
    """External channel creates an authorization request; we store it and send a push to the customer."""
    db = FirestoreClient()
    customer = db.get_customer_by_id(body.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    now = _now_iso()
    expires_dt = datetime.now(timezone.utc) + timedelta(seconds=body.expires_in_seconds)
    expires_at = expires_dt.isoformat().replace("+00:00", "Z")

    data = {
        "customer_id": body.customer_id,
        "request_type": body.request_type,
        "channel": body.channel,
        "details": body.details,
        "status": "pending",
        "created_at": now,
        "expires_at": expires_at,
    }
    request_id = db.create_auth_request(data)

    push_token = db.get_push_token(body.customer_id)
    if not push_token:
        logger.warning("No push token for customer_id=%s; user may not have registered for push yet", body.customer_id)
    type_label = body.request_type.capitalize()
    title = f"{type_label} authorization requested"
    body_text = f"Open the app to approve or reject this {body.request_type} request."
    push_sent = await _send_expo_push(
        push_token or "",
        title,
        body_text,
        {"request_id": request_id, "request_type": body.request_type},
    )

    return AuthRequestResponse(
        request_id=request_id,
        status="pending",
        request_type=body.request_type,
        channel=body.channel,
        details=body.details,
        created_at=now,
        expires_at=expires_at,
        push_sent=push_sent,
    )


@router.get("/pending/{customer_id}", response_model=list[AuthRequestResponse])
async def get_pending_auth_requests(customer_id: str):
    """Return pending (non-expired) authorization requests for the customer."""
    db = FirestoreClient()
    rows = db.get_pending_auth_requests(customer_id)
    return [
        AuthRequestResponse(
            request_id=r["id"],
            status=r.get("status", "pending"),
            request_type=r.get("request_type", ""),
            channel=r.get("channel", ""),
            details=r.get("details", {}),
            created_at=r.get("created_at", ""),
            expires_at=r.get("expires_at", ""),
        )
        for r in rows
    ]


@router.get("/request/{request_id}", response_model=AuthRequestResponse)
async def get_auth_request_details(request_id: str):
    """Get a single authorization request by id."""
    db = FirestoreClient()
    req = db.get_auth_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    now = _now_iso()
    status = req.get("status", "pending")
    if status == "pending" and (req.get("expires_at") or "") <= now:
        status = "expired"
    return AuthRequestResponse(
        request_id=req["id"],
        status=status,
        request_type=req.get("request_type", ""),
        channel=req.get("channel", ""),
        details=req.get("details", {}),
        created_at=req.get("created_at", ""),
        expires_at=req.get("expires_at", ""),
    )


@router.post("/respond")
async def respond_to_auth_request(body: AuthRespondBody):
    """User approves or rejects an authorization request. Requires request to be pending and not expired."""
    db = FirestoreClient()
    req = db.get_auth_request(body.request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("customer_id") != body.customer_id:
        raise HTTPException(status_code=403, detail="Request does not belong to this customer")
    if req.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request already responded to")
    now = _now_iso()
    if (req.get("expires_at") or "") <= now:
        raise HTTPException(status_code=400, detail="Request has expired")

    status = "approved" if body.action == "approve" else "rejected"
    db.update_auth_request_status(body.request_id, status, now)

    return {"success": True, "request_id": body.request_id, "status": status}


@router.post("/register-token")
async def register_push_token(body: RegisterTokenBody):
    """Mobile app registers its Expo push token for the logged-in customer."""
    db = FirestoreClient()
    customer = db.get_customer_by_id(body.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.set_push_token(body.customer_id, body.expo_push_token)
    return {"registered": True, "customer_id": body.customer_id}
