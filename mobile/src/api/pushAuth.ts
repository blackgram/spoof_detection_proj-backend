import { API_BASE_URL } from '../config';

export type AuthRequestType = 'login' | 'transfer' | 'consent';

export interface AuthRequestItem {
  request_id: string;
  status: string;
  request_type: AuthRequestType;
  channel: string;
  details: Record<string, unknown>;
  created_at: string;
  expires_at: string;
}

/** POST /api/push-auth/register-token */
export async function registerPushToken(
  customerId: string,
  expoPushToken: string
): Promise<{ registered: boolean; customer_id: string }> {
  const res = await fetch(`${API_BASE_URL}/api/push-auth/register-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ customer_id: customerId, expo_push_token: expoPushToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to register push token' }));
    throw new Error((err as { detail?: string }).detail || `Status ${res.status}`);
  }
  return res.json();
}

/** GET /api/push-auth/pending/{customer_id} */
export async function getPendingAuthRequests(customerId: string): Promise<AuthRequestItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/push-auth/pending/${customerId}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to get pending requests' }));
    throw new Error((err as { detail?: string }).detail || `Status ${res.status}`);
  }
  return res.json();
}

/** GET /api/push-auth/request/{request_id} */
export async function getAuthRequestDetails(requestId: string): Promise<AuthRequestItem> {
  const res = await fetch(`${API_BASE_URL}/api/push-auth/request/${requestId}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request not found' }));
    throw new Error((err as { detail?: string }).detail || `Status ${res.status}`);
  }
  return res.json();
}

/** POST /api/push-auth/respond */
export async function respondToAuthRequest(
  requestId: string,
  customerId: string,
  action: 'approve' | 'reject'
): Promise<{ success: boolean; request_id: string; status: string }> {
  const res = await fetch(`${API_BASE_URL}/api/push-auth/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ request_id: requestId, customer_id: customerId, action }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to respond' }));
    throw new Error((err as { detail?: string }).detail || `Status ${res.status}`);
  }
  return res.json();
}
