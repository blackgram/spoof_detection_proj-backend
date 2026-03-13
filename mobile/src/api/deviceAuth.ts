/**
 * Device-auth API: register key, challenge/verify (login), transaction-challenge/verify (transfer).
 */

import { API_BASE_URL } from '../config';

const BASE = `${API_BASE_URL}/api/device-auth`;
const LOG_PREFIX = '[DeviceAuth]';

async function post<T>(url: string, body: object, logLabel: string): Promise<T> {
  console.log(`${LOG_PREFIX} ${logLabel} request → ${url}`, JSON.stringify(body, null, 0).slice(0, 500));
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
    console.log(`${LOG_PREFIX} ${logLabel} response ERROR ${res.status}`, err?.detail ?? text?.slice(0, 200));
    throw new Error(err?.detail || `Status ${res.status}`);
  }
  const data = JSON.parse(text) as T;
  console.log(`${LOG_PREFIX} ${logLabel} response OK`, JSON.stringify(data, null, 0).slice(0, 500));
  return data;
}

export interface RegisterResponse {
  registered: boolean;
  customer_id: string;
}

export interface ChallengeResponse {
  challenge: string;
}

export interface VerifyResponse {
  verified: boolean;
  customer_id: string;
}

export interface TransactionChallengeResponse {
  state_id: string;
  challenge: string;
  nonce: string;
}

export interface TransactionVerifyResponse {
  authorized: boolean;
  state_id?: string;
  message?: string;
}

export async function registerDeviceKey(customerId: string, publicKeyB64: string): Promise<RegisterResponse> {
  const body = { customer_id: customerId, public_key: publicKeyB64 };
  console.log(`${LOG_PREFIX} register payload: customer_id=${customerId} public_key_len=${publicKeyB64?.length ?? 0}`);
  return post<RegisterResponse>(`${BASE}/register`, body, 'register');
}

export async function getChallenge(customerId: string): Promise<ChallengeResponse> {
  const body = { customer_id: customerId };
  return post<ChallengeResponse>(`${BASE}/challenge`, body, 'challenge');
}

export async function verifyChallenge(
  customerId: string,
  challengeB64: string,
  signatureB64: string,
  deviceName?: string | null
): Promise<VerifyResponse> {
  const body: Record<string, unknown> = {
    customer_id: customerId,
    challenge: challengeB64,
    signature: signatureB64,
  };
  if (deviceName != null && deviceName !== '') body.device_name = deviceName;
  console.log(`${LOG_PREFIX} verify payload: customer_id=${customerId} challenge_len=${challengeB64?.length ?? 0} signature_len=${signatureB64?.length ?? 0} device_name=${deviceName ?? '(none)'}`);
  return post<VerifyResponse>(`${BASE}/verify`, body, 'verify');
}

export async function getTransactionChallenge(
  customerId: string,
  amountNgn: number,
  beneficiaryAccountNumber: string
): Promise<TransactionChallengeResponse> {
  const body = {
    customer_id: customerId,
    amount_ngn: amountNgn,
    beneficiary_account_number: beneficiaryAccountNumber,
  };
  console.log(`${LOG_PREFIX} transaction-challenge payload: customer_id=${customerId} amount_ngn=${amountNgn} beneficiary=${beneficiaryAccountNumber}`);
  return post<TransactionChallengeResponse>(`${BASE}/transaction-challenge`, body, 'transaction-challenge');
}

export async function verifyTransaction(
  stateId: string,
  signatureB64: string,
  deviceName?: string | null
): Promise<TransactionVerifyResponse> {
  const body: Record<string, unknown> = { state_id: stateId, signature: signatureB64 };
  if (deviceName != null && deviceName !== '') body.device_name = deviceName;
  console.log(`${LOG_PREFIX} transaction-verify payload: state_id=${stateId} signature_len=${signatureB64?.length ?? 0} device_name=${deviceName ?? '(none)'}`);
  return post<TransactionVerifyResponse>(`${BASE}/transaction-verify`, body, 'transaction-verify');
}
