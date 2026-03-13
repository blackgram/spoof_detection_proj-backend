import { API_BASE_URL } from '../config';

export interface EnsureByUsernameResponse {
  customer_id: string;
  created: boolean;
}

/**
 * Ensure a customer exists for this username (create in Firestore if not).
 * Call on login so the app has a customer_id for transfers/KYC/biometrics.
 */
export async function ensureCustomerByUsername(username: string): Promise<EnsureByUsernameResponse> {
  const res = await fetch(`${API_BASE_URL}/api/customers/ensure-by-username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: username.trim() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `Status ${res.status}`);
  }
  return res.json();
}
