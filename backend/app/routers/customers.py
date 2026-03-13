"""Customer and account CRUD API."""

import logging
from fastapi import APIRouter, HTTPException

from app.db.firestore_client import FirestoreClient
from app.models.customer import (
    CustomerCreate,
    CustomerResponse,
    CustomerKycStatus,
    UpdateLimitBody,
    AccountResponse,
    EnsureByUsernameBody,
    EnsureByUsernameResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/customers", tags=["customers"])
db = FirestoreClient()


def _customer_to_response(c: dict) -> CustomerResponse:
    """Strip internal fields for response."""
    return CustomerResponse(
        id=c["id"],
        bvn=c["bvn"],
        name=c["name"],
        email=c.get("email"),
        phone=c.get("phone"),
        kyc_completed=c.get("kyc_completed", False),
        created_at=c.get("created_at"),
        updated_at=c.get("updated_at"),
    )


@router.post("", response_model=CustomerResponse)
async def create_customer(body: CustomerCreate):
    """Create a new customer. Returns customer_id. If BVN already exists, returns existing (idempotent by BVN optional)."""
    existing = db.get_customer_by_bvn(body.bvn)
    if existing:
        return _customer_to_response(existing)
    customer_id = db.create_customer(
        bvn=body.bvn,
        name=body.name,
        email=body.email,
        phone=body.phone,
    )
    cust = db.get_customer_by_id(customer_id)
    if not cust:
        raise HTTPException(status_code=500, detail="Failed to create customer")
    return _customer_to_response(cust)


@router.post("/ensure-by-username", response_model=EnsureByUsernameResponse)
async def ensure_customer_by_username(body: EnsureByUsernameBody):
    """
    Get existing customer for this username, or create one in Firestore (pre-KYC, no BVN).
    Call this on login so every username has a backend customer_id.
    """
    username = (body.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    try:
        customer_id, created = db.ensure_customer_for_username(username)
        return EnsureByUsernameResponse(customer_id=customer_id, created=created)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/by-bvn/{bvn}", response_model=CustomerResponse)
async def get_customer_by_bvn(bvn: str):
    """Get customer by BVN."""
    cust = db.get_customer_by_bvn(bvn)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _customer_to_response(cust)


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str):
    """Get customer by id."""
    cust = db.get_customer_by_id(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _customer_to_response(cust)


@router.get("/{customer_id}/accounts")
async def get_customer_accounts(customer_id: str):
    """List accounts for a customer (for balance display and transfer)."""
    cust = db.get_customer_by_id(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    accounts = db.get_accounts(customer_id)
    return [
        AccountResponse(
            id=a["id"],
            customer_id=customer_id,
            account_number=a["account_number"],
            account_type=a.get("account_type", "current"),
            balance_ngn=a.get("balance_ngn", 0.0),
            status=a.get("status", "active"),
            created_at=a.get("created_at"),
            updated_at=a.get("updated_at"),
        )
        for a in accounts
    ]


@router.get("/{customer_id}/kyc-status", response_model=CustomerKycStatus)
async def get_kyc_status(customer_id: str):
    """Get KYC status and current limit for a customer."""
    status = db.get_kyc_status(customer_id)
    if not status:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerKycStatus(
        customer_id=customer_id,
        kyc_completed=status["kyc_completed"],
        has_reference_image=status["has_reference_image"],
        current_limit_ngn=status.get("current_limit_ngn", 100_000),
    )


@router.patch("/{customer_id}/limit")
async def update_limit(customer_id: str, body: UpdateLimitBody):
    """Update customer's current limit (requires KYC). Clamped to 100k–50m NGN."""
    cust = db.get_customer_by_id(customer_id)
    if not cust:
        logger.warning(
            "Limit update: customer_id=%s not found (in-memory store loses data on restart; use Firestore for persistence).",
            customer_id,
        )
        raise HTTPException(status_code=404, detail="Customer not found")
    if not cust.get("kyc_completed"):
        raise HTTPException(status_code=403, detail="KYC must be completed before increasing limit")
    ok = db.update_customer_limit(customer_id, body.limit_ngn)
    if not ok:
        raise HTTPException(status_code=404, detail="Customer not found")
    new_limit = db.get_customer_limit(customer_id)
    return {"customer_id": customer_id, "current_limit_ngn": new_limit}
