const getApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type AuthRequestType = "login" | "transfer" | "consent";

export interface CreateAuthRequestParams {
  customer_id: string;
  request_type: AuthRequestType;
  channel: string;
  details: Record<string, unknown>;
  expires_in_seconds?: number;
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

/** Resolve username to customer_id (creates customer if needed). */
export async function ensureCustomerByUsername(
  username: string
): Promise<{ customer_id: string; created: boolean }> {
  const res = await fetch(`${getApiUrl()}/api/customers/ensure-by-username`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: username.trim() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed" }));
    throw new Error((err as { detail?: string }).detail || `Status ${res.status}`);
  }
  return res.json();
}

/** Create a push authorization request; backend sends push to the customer's device. */
export async function createAuthRequest(
  params: CreateAuthRequestParams
): Promise<AuthRequestResponse> {
  const res = await fetch(`${getApiUrl()}/api/push-auth/request`, {
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed" }));
    throw new Error((err as { detail?: string }).detail || `Status ${res.status}`);
  }
  return res.json();
}
