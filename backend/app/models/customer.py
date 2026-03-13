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
    email: Optional[str] = None
    phone: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(BaseModel):
    id: str
    bvn: str
    name: str
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


class KycOnboardRequest(BaseModel):
    """Request body for KYC onboarding (reference image sent as multipart file)."""
    bvn: str
    customer_id: Optional[str] = None  # If provided, update existing; else create/find by BVN
    name: Optional[str] = None
