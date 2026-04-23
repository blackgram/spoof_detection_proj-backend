"""Pydantic models for customers and accounts."""

from typing import Optional
from pydantic import BaseModel


class AccountBase(BaseModel):
    account_number: str
    account_type: str = "current"
    balance_ngn: float = 0.0
    status: str = "active"


class AccountCreate(AccountBase):
    pass


class AccountResponse(AccountBase):
    id: str
    customer_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CustomerBase(BaseModel):
    bvn: str
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(BaseModel):
    id: str
    bvn: str
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    kyc_completed: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # reference_image not returned in list/get for privacy


class CustomerKycStatus(BaseModel):
    customer_id: str
    kyc_completed: bool
    has_reference_image: bool
    current_limit_ngn: float = 100_000


class UpdateLimitBody(BaseModel):
    limit_ngn: float


class EnsureByUsernameBody(BaseModel):
    username: str


class EnsureByUsernameResponse(BaseModel):
    customer_id: str
    created: bool
    username: Optional[str] = None
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class AccountLookupResponse(BaseModel):
    account_number: str
    customer_name: str
    account_type: str = "current"


class RegisterBody(BaseModel):
    """Request body for app registration (new user with existing account number)."""
    account_number: str
    phone: str
    username: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class RegisterResponse(BaseModel):
    customer_id: str
    username: str
    account_number: str


class LoginBody(BaseModel):
    """Resolve session by username. Password is accepted for API compatibility but not validated (PoC)."""
    username: str
    password: str = ""


class LoginResponse(BaseModel):
    customer_id: str
    username: str
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    accounts: list[AccountResponse]


class KycOnboardRequest(BaseModel):
    """Request body for KYC onboarding (reference image sent as multipart file)."""
    bvn: str
    customer_id: Optional[str] = None  # If provided, update existing; else create/find by BVN
    name: Optional[str] = None
