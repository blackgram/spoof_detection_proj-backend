import { API_BASE_URL } from '../config';

export interface Account {
  id: string;
  customer_id: string;
  account_number: string;
  account_type: string;
  balance_ngn: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface TransferAuditPayload {
  user_id: string;
  device_id: string;
  public_key_id?: string;
  nonce?: string;
  transaction_hash?: string;
  digital_signature?: string;
  biometric_modality?: 'FACE' | 'FINGER';
  risk_score?: number;
}

export interface TransferRequest {
  sender_customer_id: string;
  beneficiary_account_number: string;
  amount_ngn: number;
  audit: TransferAuditPayload;
  /** Set when using FIDO2 flow (after transaction/authorize). */
  state_id?: string;
}

export interface TransferResponse {
  transaction_id: string;
  amount_ngn: number;
  beneficiary_account_number: string;
  message: string;
}

/** GET /api/customers/{customer_id}/accounts */
export async function getAccounts(customerId: string): Promise<Account[]> {
  const res = await fetch(`${API_BASE_URL}/api/customers/${customerId}/accounts`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to get accounts' }));
    throw new Error(err.detail || `Status ${res.status}`);
  }
  return res.json();
}

/** POST /api/transactions/transfer - both sender and beneficiary must be KYC verified */
export async function transfer(body: TransferRequest): Promise<TransferResponse> {
  const res = await fetch(`${API_BASE_URL}/api/transactions/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Transfer failed' }));
    throw new Error(err.detail || `Status ${res.status}`);
  }
  return res.json();
}
