import { API_BASE_URL } from '../config';

/** Timeout for KYC/ML requests (backend may load models on first call, 2–5 min). */
const KYC_REQUEST_TIMEOUT_MS = 360000; // 6 min

export const MIN_LIMIT_NGN = 100_000;
/** Matches backend Firestore clamp upper bound. */
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

/**
 * Flow B: in-house multi-capture liveness.
 * Prompts are server-issued to prevent replay of pre-recorded video.
 */
export type LivenessPrompt =
  | 'look_straight'
  | 'turn_left'
  | 'turn_right'
  | 'smile'
  | 'blink'
  | 'nod';

export interface LivenessStartResponse {
  session_id: string;
  customer_id: string;
  nonce: string;
  prompts: LivenessPrompt[];
  expires_at: string;
  max_retries: number;
}

export interface PerFrameScore {
  prompt: LivenessPrompt;
  is_real: boolean;
  confidence: number;
  reason?: string | null;
}

export interface ReplaySignals {
  phash_distances: number[];
  brightness_stddev_spread: number;
  is_suspicious_identical: boolean;
  is_suspicious_scene_change: boolean;
  is_suspicious_uniform_brightness: boolean;
  notes: string[];
}

export interface MultiCaptureVerificationResult
  extends Omit<VerificationResult, 'overall_result'> {
  overall_result: 'pass' | 'fail' | 'spoof_detected' | 'step_up' | 'retry';
  session_id: string;
  per_frame_scores: PerFrameScore[];
  replay_signals: ReplaySignals;
  risk_flags: string[];
}

/** HTTP error from KYC liveness endpoints (includes status for session/expiry handling). */
export class KycApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'KycApiError';
    this.status = status;
  }
}

async function kycApiErrorFromResponse(res: Response, fallback: string): Promise<KycApiError> {
  const err = await res.json().catch(() => ({ detail: fallback }));
  const detail = typeof err.detail === 'string' ? err.detail : fallback;
  return new KycApiError(detail || `Status ${res.status}`, res.status);
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
/**
 * POST /api/kyc/liveness/start
 * Form: customer_id
 * Returns a short-lived session with randomised prompts.
 */
export async function kycLivenessStart(customerId: string): Promise<LivenessStartResponse> {
  console.log('[kycLivenessStart] request', { customerId });
  const formData = new FormData();
  formData.append('customer_id', customerId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), KYC_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/kyc/liveness/start`, {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const apiErr = await kycApiErrorFromResponse(res, 'Failed to start liveness session');
    console.log('[kycLivenessStart] failed', { customerId, status: apiErr.status, detail: apiErr.message });
    throw apiErr;
  }
  const data = await res.json();
  console.log('[kycLivenessStart] success', {
    customerId,
    session_id: data.session_id,
    prompts: data.prompts,
    expires_at: data.expires_at,
  });
  return data;
}

/**
 * POST /api/kyc/liveness/verify
 * Multipart with one frame per server-issued prompt (up to 5) + ordered
 * capture timestamps + session_id. Server is authoritative.
 */
export async function kycLivenessVerify(params: {
  customerId: string;
  sessionId: string;
  nonce: string;
  frames: { uri: string; capturedAtMs: number }[];
  /** When set, frame count must match server prompt count exactly. */
  expectedPromptCount?: number;
}): Promise<MultiCaptureVerificationResult> {
  console.log('[kycLivenessVerify] request', {
    customerId: params.customerId,
    sessionId: params.sessionId,
    frames: params.frames.length,
    expectedPromptCount: params.expectedPromptCount,
  });
  if (params.expectedPromptCount != null && params.frames.length !== params.expectedPromptCount) {
    throw new Error(
      `Expected ${params.expectedPromptCount} frames for this session, got ${params.frames.length}.`
    );
  }
  if (params.frames.length < 2) {
    throw new Error('At least two frames are required.');
  }
  if (params.frames.length > 5) {
    throw new Error('At most five frames are supported.');
  }

  const formData = new FormData();
  formData.append('customer_id', params.customerId);
  formData.append('session_id', params.sessionId);
  formData.append('nonce', params.nonce);
  formData.append(
    'timestamps',
    JSON.stringify(params.frames.map((f) => f.capturedAtMs))
  );
  params.frames.forEach((f, i) => {
    formData.append(`frame_${i}`, {
      uri: f.uri,
      name: `frame_${i}.jpg`,
      type: 'image/jpeg',
    } as any);
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), KYC_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/kyc/liveness/verify`, {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const apiErr = await kycApiErrorFromResponse(res, 'Liveness verification failed');
    console.log('[kycLivenessVerify] failed', {
      customerId: params.customerId,
      sessionId: params.sessionId,
      status: apiErr.status,
      detail: apiErr.message,
    });
    throw apiErr;
  }
  const data = await res.json();
  console.log('[kycLivenessVerify] success', {
    sessionId: data.session_id,
    overall_result: data.overall_result,
    risk_flags: data.risk_flags,
  });
  return data;
}

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
