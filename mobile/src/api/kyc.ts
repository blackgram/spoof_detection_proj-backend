import { API_BASE_URL } from '../config';

/** Timeout for KYC/ML requests (backend may load models on first call, 2–5 min). */
const KYC_REQUEST_TIMEOUT_MS = 360000; // 6 min

export const MIN_LIMIT_NGN = 100_000;
export const MAX_LIMIT_NGN = 50_000_000;

export interface KycStatus {
  customer_id: string;
  kyc_completed: boolean;
  has_reference_image: boolean;
  current_limit_ngn: number;
}

export interface VerificationResult {
  liveness_check: { is_real: boolean; confidence: number };
  face_verification: { verified: boolean; confidence: number; distance: number };
  overall_result: 'pass' | 'fail' | 'spoof_detected';
  message: string;
}

/** GET /api/customers/{customer_id}/kyc-status */
export async function getKycStatus(customerId: string): Promise<KycStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), KYC_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/customers/${customerId}/kyc-status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to get KYC status' }));
    throw new Error(err.detail || `Status ${res.status}`);
  }
  return res.json();
}

/** PATCH /api/customers/{customer_id}/limit - requires KYC. */
export async function updateLimit(customerId: string, limitNg: number): Promise<{ customer_id: string; current_limit_ngn: number }> {
  const res = await fetch(`${API_BASE_URL}/api/customers/${customerId}/limit`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ limit_ngn: limitNg }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update limit' }));
    const detail = err?.detail ?? (res.status === 404 ? 'Customer not found' : `Request failed (${res.status})`);
    throw new Error(detail);
  }
  return res.json();
}

/**
 * POST /api/kyc/onboard
 * Form: bvn, name, reference_image (file), optional customer_id (from ensure-by-username).
 * When customer_id is provided, the existing customer is updated with BVN and reference.
 */
export async function kycOnboard(params: {
  bvn: string;
  name: string;
  referenceImageUri: string;
  customerId?: string;
}): Promise<{ customer_id: string; kyc_completed: boolean }> {
  const formData = new FormData();
  formData.append('bvn', params.bvn.trim());
  formData.append('name', params.name.trim());
  if (params.customerId?.trim()) {
    formData.append('customer_id', params.customerId.trim());
  }
  formData.append('reference_image', {
    uri: params.referenceImageUri,
    name: 'reference.jpg',
    type: 'image/jpeg',
  } as any);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), KYC_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/kyc/onboard`, {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'KYC onboarding failed' }));
    throw new Error(err.detail || `Status ${res.status}`);
  }
  return res.json();
}

/**
 * POST /api/kyc/verify
 * Form: customer_id, selfie_image (file)
 * Returns VerificationResult.
 */
export async function kycVerify(customerId: string, selfieImageUri: string): Promise<VerificationResult> {
  const formData = new FormData();
  formData.append('customer_id', customerId);
  formData.append('selfie_image', {
    uri: selfieImageUri,
    name: 'selfie.jpg',
    type: 'image/jpeg',
  } as any);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), KYC_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/kyc/verify`, {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Verification failed' }));
    throw new Error(err.detail || `Status ${res.status}`);
  }
  return res.json();
}
