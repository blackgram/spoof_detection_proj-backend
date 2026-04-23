/**
 * Keycloak TOTP Extension API client.
 * Base: {keycloakHost}/realms/{realm}/totp-registration/totp
 */

const KEYCLOAK_BASE_URL =
  process.env.EXPO_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.EXPO_PUBLIC_KEYCLOAK_REALM || 'master';
const BASE = `${KEYCLOAK_BASE_URL}/realms/${REALM}/totp-registration/totp`;

export interface RegisterTotpResponse {
  success: boolean;
  message: string;
  totpSecret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

export interface VerifyTotpResponse {
  valid: boolean;
  message: string;
}

export interface TotpStatusResponse {
  userId: string;
  hasTotp: boolean;
  totpEnabled: boolean;
}

async function request<T>(
  url: string,
  options: RequestInit,
  accessToken: string,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = `Status ${res.status}`;
    try {
      const err = JSON.parse(text);
      detail = err.error || err.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return JSON.parse(text) as T;
}

export async function registerTotp(
  accessToken: string,
  userId: string,
  userLabel?: string,
  totpSecret?: string,
): Promise<RegisterTotpResponse> {
  const body: Record<string, string> = { userId };
  if (userLabel) body.userLabel = userLabel;
  if (totpSecret) body.totpSecret = totpSecret;
  return request<RegisterTotpResponse>(`${BASE}/register`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, accessToken);
}

export async function verifyTotp(
  accessToken: string,
  userId: string,
  totpCode: string,
): Promise<VerifyTotpResponse> {
  return request<VerifyTotpResponse>(`${BASE}/verify`, {
    method: 'POST',
    body: JSON.stringify({ userId, totpCode }),
  }, accessToken);
}

export async function getTotpStatus(
  accessToken: string,
  userId: string,
): Promise<TotpStatusResponse> {
  return request<TotpStatusResponse>(`${BASE}/${userId}/status`, {
    method: 'GET',
  }, accessToken);
}

export async function removeTotp(
  accessToken: string,
  userId: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(`${BASE}/${userId}`, {
    method: 'DELETE',
  }, accessToken);
}
