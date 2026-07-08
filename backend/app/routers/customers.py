"""Customer and account CRUD API."""

import logging
from fastapi import APIRouter, HTTPException

from app.db.firestore_client import FirestoreClient
from app.models.customer import (
    AccountLookupResponse,
    CustomerCreate,
    CustomerResponse,
    CustomerKycStatus,
    UpdateLimitBody,
    AccountResponse,
    EnsureByUsernameBody,
    EnsureByUsernameResponse,
    RegisterBody,
    RegisterResponse,
    LoginBody,
    LoginResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/customers", tags=["customers"])
db = FirestoreClient()


def _mask_account_no(account_no: str) -> str:
    s = (account_no or "").strip()
    if len(s) <= 4:
        return "****"
    return f"{'*' * (len(s) - 4)}{s[-4:]}"


def _customer_to_response(c: dict) -> CustomerResponse:
    """Strip internal fields for response."""
    return CustomerResponse(
        id=c["id"],
        bvn=c["bvn"],
        name=c["name"],
        first_name=c.get("first_name"),
        last_name=c.get("last_name"),
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
        first_name=body.first_name,
        last_name=body.last_name,
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
        cust = db.get_customer_by_id(customer_id)
        if not cust:
            raise HTTPException(status_code=500, detail="Failed to load customer")
        uname = (cust.get("username") or username).strip()
        return EnsureByUsernameResponse(
            customer_id=customer_id,
            created=created,
            username=uname,
            name=cust.get("name") or uname,
            first_name=cust.get("first_name"),
            last_name=cust.get("last_name"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/register", response_model=RegisterResponse)
async def register(body: RegisterBody):
    """
    Register a new app user with an existing account number (PoC: no validation of account).
    Creates customer, account, and stores password hash. Returns customer_id for KYC flow.
    """
    username = (body.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    account_number = (body.account_number or "").strip()
    if not account_number:
        raise HTTPException(status_code=400, detail="account_number is required")
    phone = (body.phone or "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="phone is required")
    if not (body.password or "").strip():
        raise HTTPException(status_code=400, detail="password is required")

    logger.info(
        "Registration request username=%s account_no=%s phone_len=%d",
        username,
        _mask_account_no(account_number),
        len(phone),
    )

    existing = db.get_customer_by_username(username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    customer_id = db.create_customer(
        bvn=(body.bvn or "").strip(),
        name=username,
        email=None,
        phone=phone,
        username=username,
        first_name=(body.first_name or "").strip() or None,
        last_name=(body.last_name or "").strip() or None,
    )
    db.add_account(customer_id, account_number, "current", 500_000_000.0)
    db.store_customer_password(customer_id, body.password)
    # Store the account number so liveness/verify can call AccountImageCollection API
    db.set_customer_account_no(customer_id, account_number)
    # KYC flag left False — the liveness challenge completes it
    db.update_customer_limit(customer_id, 1_000_000.0)
    logger.info(
        "Registration created customer_id=%s username=%s account_no=%s kyc_completed=%s",
        customer_id,
        username,
        _mask_account_no(account_number),
        False,
    )
    return RegisterResponse(customer_id=customer_id, username=username, account_number=account_number)


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginBody):
    """
    Resolve customer by username only (PoC: no password check on the server).
    Returns customer id, name, and accounts. Password is ignored if sent.
    """
    username = (body.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    cust = db.get_customer_by_username(username)
    if not cust:
        raise HTTPException(status_code=404, detail="No user found with this username")
    customer_id = cust["id"]
    accounts_raw = db.get_accounts(customer_id)
    accounts = [
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
        for a in accounts_raw
    ]
    return LoginResponse(
        customer_id=customer_id,
        username=username,
        name=cust.get("name") or username,
        first_name=cust.get("first_name"),
        last_name=cust.get("last_name"),
        accounts=accounts,
    )


@router.get("/lookup-account/{account_number}", response_model=AccountLookupResponse)
async def lookup_account(account_number: str):
    """Look up a beneficiary account by number. Returns the account holder name."""
    acc = db.get_account_by_account_number(account_number)
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    cust = db.get_customer_by_id(acc["customer_id"])
    if not cust:
        raise HTTPException(status_code=404, detail="Account holder not found")
    return AccountLookupResponse(
        account_number=acc["account_number"],
        customer_name=cust.get("name", "Unknown"),
        account_type=acc.get("account_type", "current"),
    )


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
