import { API_BASE_URL } from '../config';

export interface VerificationResult {
  liveness_check: {
    is_real: boolean;
    confidence: number;
  };
  face_verification: {
    verified: boolean;
    confidence: number;
    distance: number;
  };
  overall_result: 'pass' | 'fail' | 'spoof_detected';
  message: string;
}

export async function verifyIdentity(
  idImageUri: string,
  selfieImageUri: string
): Promise<VerificationResult> {
  const url = `${API_BASE_URL}/api/verify`;
  console.log('[API] verifyIdentity: POST', url);
  console.log('[API] id_image uri:', idImageUri);
  console.log('[API] selfie_image uri:', selfieImageUri);

  const formData = new FormData();

  // React Native FormData accepts { uri, name, type } for file uploads
  formData.append('id_image', {
    uri: idImageUri,
    name: 'id_image.jpg',
    type: 'image/jpeg',
  } as any);

  formData.append('selfie_image', {
    uri: selfieImageUri,
    name: 'selfie_image.jpg',
    type: 'image/jpeg',
  } as any);

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min for ML inference

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    console.error('[API] verifyIdentity: fetch failed', duration, 'ms', err);
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Verification may take up to 2 minutes.');
      }
      throw new Error(err.message || 'Network request failed');
    }
    throw err;
  }
  clearTimeout(timeoutId);
  const duration = Date.now() - startTime;

  console.log('[API] verifyIdentity: response', response.status, `${duration}ms`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Verification failed' }));
    const message = typeof errorData.detail === 'string' ? errorData.detail : errorData.detail?.[0]?.msg || errorData.message || 'Verification failed';
    console.error('[API] verifyIdentity: error', response.status, message);
    console.error('[API] verifyIdentity: errorData', JSON.stringify(errorData));
    throw new Error(message);
  }

  const data = await response.json();
  console.log('[API] verifyIdentity: success', {
    overall_result: data.overall_result,
    liveness: data.liveness_check?.is_real,
    face_verified: data.face_verification?.verified,
  });
  return data;
}
