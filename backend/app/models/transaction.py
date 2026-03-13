"""Pydantic models for transfers and audit log (AccessMore-style)."""

from typing import Optional
from pydantic import BaseModel, Field


class TransferAuditPayload(BaseModel):
    """Audit fields for non-repudiation (FIDO2/KYC architecture)."""
    user_id: str = Field(..., description="User/customer identifier")
    device_id: str = Field(..., description="Device fingerprint")
    public_key_id: str = Field(default="", description="FIDO2 credential / public key id")
    nonce: str = Field(default="", description="Challenge nonce")
    transaction_hash: str = Field(default="", description="Hash(amount + beneficiary + timestamp + nonce)")
    digital_signature: str = Field(default="", description="Signature over transaction hash")
    biometric_modality: str = Field(default="FACE", description="FACE or FINGER")
    risk_score: Optional[float] = Field(default=None, description="Risk engine score")


class TransferRequest(BaseModel):
    """Request body for POST /api/transactions/transfer."""
    sender_customer_id: str
    beneficiary_account_number: str
    amount_ngn: float = Field(..., gt=0)
    audit: TransferAuditPayload
    state_id: Optional[str] = Field(default=None, description="FIDO2 transaction authorization state from /api/fido2/transaction/authorize")


class TransferResponse(BaseModel):
    """Response after successful transfer."""
    transaction_id: str
    amount_ngn: float
    beneficiary_account_number: str
    message: str = "Transfer successful"
