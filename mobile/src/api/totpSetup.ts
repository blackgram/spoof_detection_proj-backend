/**
 * Backend-driven TOTP provisioning.
 * Calls our FastAPI backend which handles Keycloak admin auth,
 * user creation, and TOTP registration in one request.
 */

import { API_BASE_URL } from '../config';

export interface TotpSetupResponse {
  success: boolean;
  totp_secret: string;
  qr_code_url: string;
  manual_entry_key: string;
  keycloak_user_id: string;
  message: string;
}

export async function setupTotpForCustomer(
  customerId: string,
  username: string,
): Promise<TotpSetupResponse> {
  const res = await fetch(`${API_BASE_URL}/api/totp/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ customer_id: customerId, username }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'TOTP setup failed' }));
    throw new Error(err.detail || `Status ${res.status}`);
  }
  return res.json();
}
