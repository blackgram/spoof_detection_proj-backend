import { API_BASE_URL } from '@/lib/config';

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

export async function registerPushToken(
  username: string,
  expoPushToken: string,
): Promise<{ registered: boolean; customer_id: string }> {
  const url = `${API_BASE_URL}/api/push-auth/register-token`;
  console.log('[API] POST', url, { username });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      customer_id: username,
      expo_push_token: expoPushToken,
    }),
  });
  console.log('[API] POST', url, '->', res.status);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to register push token' }));
    console.error('[API] POST failed', url, { status: res.status, payload: err });
    throw new Error((err as { detail?: string }).detail || `Status ${res.status}`);
  }
  return res.json();
}

export async function getPendingAuthRequests(
  username: string,
): Promise<AuthRequestItem[]> {
  const url = `${API_BASE_URL}/api/push-auth/pending/${encodeURIComponent(username)}`;
  console.log('[API] GET', url);
  const res = await fetch(
    url,
    { headers: { Accept: 'application/json' } },
  );
  console.log('[API] GET', url, '->', res.status);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to get pending requests' }));
    console.error('[API] GET failed', url, { status: res.status, payload: err });
    throw new Error((err as { detail?: string }).detail || `Status ${res.status}`);
  }
  return res.json();
}

export async function getAuthRequestDetails(
  requestId: string,
): Promise<AuthRequestItem> {
  const url = `${API_BASE_URL}/api/push-auth/request/${encodeURIComponent(requestId)}`;
  console.log('[API] GET', url);
  const res = await fetch(
    url,
    { headers: { Accept: 'application/json' } },
  );
  console.log('[API] GET', url, '->', res.status);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request not found' }));
    console.error('[API] GET failed', url, { status: res.status, payload: err });
    throw new Error((err as { detail?: string }).detail || `Status ${res.status}`);
  }
  return res.json();
}

export async function respondToAuthRequest(
  requestId: string,
  username: string,
  action: 'approve' | 'reject',
): Promise<{ success: boolean; request_id: string; status: string }> {
  const url = `${API_BASE_URL}/api/push-auth/respond`;
  console.log('[API] POST', url, { requestId, username, action });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      request_id: requestId,
      customer_id: username,
      action,
    }),
  });
  console.log('[API] POST', url, '->', res.status);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to respond' }));
    console.error('[API] POST failed', url, { status: res.status, payload: err });
    throw new Error((err as { detail?: string }).detail || `Status ${res.status}`);
  }
  return res.json();
}
