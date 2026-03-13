"""Transfer and audit API (AccessMore-style: KYC-verified customers, audit log)."""

import logging
from fastapi import APIRouter, HTTPException, Request

from app.db.firestore_client import FirestoreClient
from app.models.transaction import TransferRequest, TransferResponse
from app.routers.fido2 import consume_authorized_transaction

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/transactions", tags=["transactions"])
db = FirestoreClient()


@router.post("/transfer", response_model=TransferResponse)
async def transfer(request: Request, body: TransferRequest):
    """
    Transfer amount from sender (KYC-verified) to beneficiary account (KYC-verified).
    When using FIDO2: call /api/fido2/transaction/initiate, sign challenge with passkey,
    then /api/fido2/transaction/authorize, then POST here with state_id in body.
    Debits sender's primary account, credits beneficiary; writes audit log.
    """
    client_ip = request.client.host if request.client else None

    if body.state_id:
        pending = consume_authorized_transaction(body.state_id)
        if not pending:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired FIDO2 authorization. Complete transaction/initiate and transaction/authorize first.",
            )
        if (
            pending["customer_id"] != body.sender_customer_id
            or pending["amount_ngn"] != body.amount_ngn
            or pending["beneficiary_account_number"] != body.beneficiary_account_number
        ):
            raise HTTPException(status_code=400, detail="Transfer params do not match authorized transaction")

    sender_accounts = db.get_accounts(body.sender_customer_id)
    if not sender_accounts:
        raise HTTPException(status_code=400, detail="Sender has no account")
    sender_account_id = sender_accounts[0]["id"]
    audit_dict = body.audit.model_dump()
    try:
        transaction_id = db.execute_transfer(
            sender_customer_id=body.sender_customer_id,
            sender_account_id=sender_account_id,
            beneficiary_account_number=body.beneficiary_account_number,
            amount_ngn=body.amount_ngn,
            audit_payload=audit_dict,
            client_ip=client_ip,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return TransferResponse(
        transaction_id=transaction_id,
        amount_ngn=body.amount_ngn,
        beneficiary_account_number=body.beneficiary_account_number,
    )
