import { API_BASE_URL } from '../config';

export interface EnsureByUsernameResponse {
  customer_id: string;
  created: boolean;
}

export interface RegisterResponse {
  customer_id: string;
  username: string;
  account_number: string;
}

export interface RegisterParams {
  account_number: string;
  phone: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  bvn?: string;
}

/**
 * Register a new app user (customer + account). Returns customer_id for KYC flow.
 */
export async function registerCustomer(params: RegisterParams): Promise<RegisterResponse> {
  const masked = `${'*'.repeat(Math.max(params.account_number.trim().length - 4, 0))}${params.account_number.trim().slice(-4)}`;
  console.log('[registerCustomer] request', {
    username: params.username.trim(),
    account_no: masked || '****',
    has_first_name: Boolean(params.first_name?.trim()),
    has_last_name: Boolean(params.last_name?.trim()),
  });
  const res = await fetch(`${API_BASE_URL}/api/customers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      account_number: params.account_number.trim(),
      phone: params.phone.trim(),
      username: params.username.trim(),
      password: params.password,
      first_name: params.first_name?.trim() || undefined,
      last_name: params.last_name?.trim() || undefined,
      bvn: params.bvn?.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    console.log('[registerCustomer] failed', { status: res.status, detail: err.detail });
    throw new Error(err.detail || `Status ${res.status}`);
  }
  const data = await res.json();
  console.log('[registerCustomer] success', {
    customer_id: data.customer_id,
    username: data.username,
    account_no: `${'*'.repeat(Math.max(String(data.account_number || '').length - 4, 0))}${String(data.account_number || '').slice(-4)}`,
  });
  return data;
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
