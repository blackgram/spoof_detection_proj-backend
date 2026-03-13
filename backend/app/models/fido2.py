"""Pydantic models for FIDO2 / Passkey API (registration, authentication, transaction challenge)."""

from typing import Any

from pydantic import BaseModel, Field


class Fido2CustomerBody(BaseModel):
    """Request body for endpoints that operate per customer."""
    customer_id: str = Field(..., description="Customer identifier (from KYC)")


class Fido2RegisterCompleteBody(BaseModel):
    """Client attestation response after create credential. Opaque payload from authenticator."""
    credential: dict[str, Any] = Field(..., description="PublicKeyCredential from client (id, response, type)")


class Fido2AuthenticateCompleteBody(BaseModel):
    """Client assertion response after getAssertion. Opaque payload from authenticator."""
    assertion: dict[str, Any] = Field(..., description="Assertion response from client (authenticatorData, signature, etc.)")


class Fido2TransactionInitiateBody(BaseModel):
    """Request to get a transaction signing challenge (amount + beneficiary)."""
    customer_id: str = Field(..., description="Sender customer id")
    amount_ngn: float = Field(..., gt=0)
    beneficiary_account_number: str = Field(..., min_length=1)


class Fido2TransactionAuthorizeBody(BaseModel):
    """Request to authorize a transfer with a FIDO2 assertion (signed transaction challenge)."""
    state_id: str = Field(..., description="Session from /transaction/initiate")
    assertion: dict[str, Any] = Field(..., description="Assertion from authenticator (signed challenge)")
    sender_customer_id: str = Field(..., description="Must match state")
    beneficiary_account_number: str = Field(..., min_length=1)
    amount_ngn: float = Field(..., gt=0)
