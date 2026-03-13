/**
 * FIDO2 / Passkey API – authentication and transaction authorization.
 * KYC flow remains for limits and device registration; this is for login and transfer signing.
 */

import { API_BASE_URL } from '../config';

const BASE = `${API_BASE_URL}/api/fido2`;

export function getFido2BaseUrl(): string {
  return BASE;
}

/** WebAuthn credential creation options from server (register/begin). */
export interface CredentialCreationOptions {
  challenge: string;
  rp?: { id: string; name: string };
  user?: { id: string; name: string; displayName?: string };
  pub_key_cred_params?: { type: string; alg: number }[];
  pubKeyCredParams?: { type: string; alg: number }[];
  exclude_credentials?: { type: string; id: string }[];
  excludeCredentials?: { type: string; id: string }[];
  timeout?: number;
  authenticatorSelection?: Record<string, unknown>;
  authenticator_selection?: Record<string, unknown>;
}

/** WebAuthn assertion request options from server (authenticate/begin or transaction challenge). */
export interface AssertionRequestOptions {
  challenge: string;
  allow_credentials?: { type: string; id: string }[];
  allowCredentials?: { type: string; id: string }[];
  rpId?: string;
  timeout?: number;
}

/** PublicKeyCredential from client (registration). */
export interface PublicKeyCredentialAttestation {
  id?: string;
  rawId?: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
  };
  type: string;
}

/** Assertion response from client (authentication / transaction sign). */
export interface AssertionResponse {
  credentialId?: string;
  rawId?: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  userHandle?: string;
}

export interface TransactionInitiateResponse {
  state_id: string;
  challenge: string;
  nonce: string;
}

export interface TransactionAuthorizeResponse {
  authorized: boolean;
  state_id?: string;
  message?: string;
}

async function post<T>(url: string, body: object): Promise<T> {
  console.log('[FIDO2] POST', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let err: { detail?: string } = { detail: 'Request failed' };
    try {
      err = JSON.parse(text || '{}') as { detail?: string };
    } catch {
      err = { detail: text?.slice(0, 200) || `Status ${res.status}` };
    }
    console.error('[FIDO2] POST failed', res.status, text?.slice(0, 200));
    throw new Error(err?.detail || `Status ${res.status}`);
  }
  return JSON.parse(text) as T;
}

/** Start passkey registration. Returns options to pass to native createCredential. */
export async function registerBegin(customerId: string): Promise<CredentialCreationOptions> {
  console.log('[FIDO2] registerBegin request customerId=', customerId);
  const out = await post<CredentialCreationOptions>(`${BASE}/register/begin`, { customer_id: customerId });
  console.log('[FIDO2] registerBegin response:', {
    challengeLength: typeof out.challenge === 'string' ? out.challenge.length : 0,
    rp: out.rp,
    user: out.user ? { id: (out.user as { id?: string }).id?.length, name: (out.user as { name?: string }).name } : null,
    excludeCredentialsCount: (out.exclude_credentials ?? out.excludeCredentials)?.length ?? 0,
  });
  return out;
}

/** Complete registration with attestation from device. */
export async function registerComplete(
  customerId: string,
  credential: PublicKeyCredentialAttestation
): Promise<{ status: string; credential_id?: string }> {
  console.log('[FIDO2] registerComplete request customerId=', customerId, 'credential keys:', Object.keys(credential ?? {}), 'response keys:', credential?.response ? Object.keys(credential.response) : []);
  const out = await post<{ status: string; credential_id?: string }>(
    `${BASE}/register/complete/${encodeURIComponent(customerId)}`,
    { credential }
  );
  console.log('[FIDO2] registerComplete response:', out);
  return out;
}

/** Start passkey authentication (login). Returns options for getAssertion. */
export async function authenticateBegin(customerId: string): Promise<AssertionRequestOptions> {
  return post<AssertionRequestOptions>(`${BASE}/authenticate/begin`, { customer_id: customerId });
}

/** Complete login with assertion from device. */
export async function authenticateComplete(
  customerId: string,
  assertion: AssertionResponse
): Promise<{ authenticated: boolean }> {
  return post(`${BASE}/authenticate/complete/${encodeURIComponent(customerId)}`, { assertion });
}

/** Get transaction signing challenge. Sign this with passkey, then call transactionAuthorize. */
export async function transactionInitiate(
  customerId: string,
  amountNgn: number,
  beneficiaryAccountNumber: string
): Promise<TransactionInitiateResponse> {
  return post<TransactionInitiateResponse>(`${BASE}/transaction/initiate`, {
    customer_id: customerId,
    amount_ngn: amountNgn,
    beneficiary_account_number: beneficiaryAccountNumber,
  });
}

/** Verify signed assertion and authorize transfer. Then call transfer() with state_id. */
export async function transactionAuthorize(
  stateId: string,
  assertion: AssertionResponse,
  senderCustomerId: string,
  beneficiaryAccountNumber: string,
  amountNgn: number
): Promise<TransactionAuthorizeResponse> {
  return post<TransactionAuthorizeResponse>(`${BASE}/transaction/authorize`, {
    state_id: stateId,
    assertion,
    sender_customer_id: senderCustomerId,
    beneficiary_account_number: beneficiaryAccountNumber,
    amount_ngn: amountNgn,
  });
}
