/**
 * FastAPI backend client for ibank (same API as mobile / channel-test).
 */

export const API_BASE_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
    : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Transfers at or above this amount require push authorization on the mobile app first. */
export const HIGH_VALUE_TRANSFER_NGN = 500_000;

export interface Account {
  id: string;
  customer_id: string;
  account_number: string;
  account_type: string;
  balance_ngn: number;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LoginResponse {
  customer_id: string;
  username: string;
  name: string;
  accounts: Account[];
}

export interface RegisterParams {
  account_number: string;
  phone: string;
  username: string;
  password: string;
}

export interface RegisterResponse {
  customer_id: string;
  username: string;
  account_number: string;
}

export interface TransferAuditPayload {
  user_id: string;
  device_id: string;
  public_key_id?: string;
  nonce?: string;
  transaction_hash?: string;
  digital_signature?: string;
  biometric_modality?: "FACE" | "FINGER";
  risk_score?: number;
}

export interface TransferRequest {
  sender_customer_id: string;
  beneficiary_account_number: string;
  amount_ngn: number;
  audit: TransferAuditPayload;
  state_id?: string;
}

export interface TransferResponse {
  transaction_id: string;
  amount_ngn: number;
  beneficiary_account_number: string;
  message: string;
}

export interface AccountLookup {
  account_number: string;
  customer_name: string;
  account_type: string;
}

export interface AuthRequestResponse {
  request_id: string;
  status: string;
  request_type: string;
  channel: string;
  details: Record<string, unknown>;
  created_at: string;
  expires_at: string;
  push_sent?: boolean;
}

export interface VerifyTotpForTransferResponse {
  valid: boolean;
  message: string;
  keycloak_user_id: string;
}

async function parseError(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({ detail: "Request failed" }));
  const d = err.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x: { msg?: string }) => x.msg).filter(Boolean).join(", ") || "Request failed";
  return "Request failed";
}

/**
 * POST /api/customers/login — resolves customer by username only; password is ignored by the server (PoC).
 * Still used for transfer “PIN” step so the UI can require a confirmation without server password checks.
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/customers/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** POST /api/customers/register */
export async function registerCustomer(params: RegisterParams): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE_URL}/api/customers/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      account_number: params.account_number.trim(),
      phone: params.phone.trim(),
      username: params.username.trim(),
      password: params.password,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export interface KycStatus {
  customer_id: string;
  kyc_completed: boolean;
  has_reference_image: boolean;
  current_limit_ngn: number;
}

/** GET /api/customers/{customer_id}/kyc-status */
export async function getKycStatus(customerId: string): Promise<KycStatus> {
  const res = await fetch(`${API_BASE_URL}/api/customers/${customerId}/kyc-status`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** GET /api/customers/{customer_id}/accounts */
export async function getAccounts(customerId: string): Promise<Account[]> {
  const res = await fetch(`${API_BASE_URL}/api/customers/${customerId}/accounts`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** GET /api/customers/lookup-account/{account_number} */
export async function lookupAccount(
  accountNumber: string,
  signal?: AbortSignal
): Promise<AccountLookup> {
  const res = await fetch(
    `${API_BASE_URL}/api/customers/lookup-account/${encodeURIComponent(accountNumber.trim())}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    }
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** Synthetic audit for web PoC (no device keys). */
export function buildWebAuditPayload(
  senderCustomerId: string,
  amountNgn: number,
  beneficiaryAccountNumber: string
): TransferAuditPayload {
  const nonce =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const raw = `${senderCustomerId}|${beneficiaryAccountNumber}|${amountNgn}|${nonce}`;
  const transaction_hash =
    typeof btoa !== "undefined"
      ? btoa(unescape(encodeURIComponent(raw))).slice(0, 64)
      : raw.slice(0, 64);
  return {
    user_id: senderCustomerId,
    device_id: "ibank_web",
    public_key_id: "",
    nonce,
    transaction_hash,
    digital_signature: "",
    biometric_modality: "FACE",
  };
}

/** POST /api/transactions/transfer */
export async function transfer(body: TransferRequest): Promise<TransferResponse> {
  const res = await fetch(`${API_BASE_URL}/api/transactions/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** POST /api/push-auth/request */
export async function createPushAuthRequest(params: {
  customer_id: string;
  request_type: "login" | "transfer" | "consent";
  channel: string;
  details: Record<string, unknown>;
  expires_in_seconds?: number;
}): Promise<AuthRequestResponse> {
  const res = await fetch(`${API_BASE_URL}/api/push-auth/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      customer_id: params.customer_id,
      request_type: params.request_type,
      channel: params.channel,
      details: params.details,
      expires_in_seconds: params.expires_in_seconds ?? 300,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** GET /api/push-auth/request/{request_id} */
export async function getPushAuthRequest(requestId: string): Promise<AuthRequestResponse> {
  const res = await fetch(`${API_BASE_URL}/api/push-auth/request/${encodeURIComponent(requestId)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** POST /api/totp/verify */
export async function verifyTotpForTransfer(params: {
  customer_id: string;
  username: string;
  totp_code: string;
}): Promise<VerifyTotpForTransferResponse> {
  const res = await fetch(`${API_BASE_URL}/api/totp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      customer_id: params.customer_id,
      username: params.username.trim(),
      totp_code: params.totp_code.trim(),
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
