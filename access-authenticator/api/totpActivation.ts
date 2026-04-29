import { ACTIVATE_SECRET, API_BASE_URL } from '@/lib/config';

export type ChannelCode = 'PRIMUSPLUS' | 'IBANK' | 'SME';

export type ActivateRequest = {
  channelUsername: string;
  channel: ChannelCode;
  activationCode: string;
};

export type ActivateResponse = {
  totpSecret: string;
  keycloakUserId: string;
  keycloakUsername: string;
  message: string;
};

type ApiError = {
  detail?: string;
  message?: string;
};

function buildActivationError(status: number, payload?: ApiError) {
  const fromPayload = payload?.detail || payload?.message;
  if (fromPayload) return new Error(fromPayload);

  switch (status) {
    case 404:
      return new Error('User is not registered for activation.');
    case 409:
      return new Error('User is already registered.');
    case 410:
      return new Error('Activation code has expired. Request a new code.');
    case 422:
      return new Error('Activation code is invalid.');
    case 502:
      return new Error('Activation service is unavailable. Please try again.');
    default:
      return new Error(`Activation failed (status ${status}).`);
  }
}

export async function activateTotp(request: ActivateRequest): Promise<ActivateResponse> {
  const url = `${API_BASE_URL}/api/v1/totp/activate`;
  console.log('[API] POST', url, { channel: request.channel, channelUsername: request.channelUsername });
  if (!ACTIVATE_SECRET) {
    console.warn('[API] Missing activation secret. Set EXPO_PUBLIC_ACTIVATE_SECRET in .env.local');
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Activate-Secret': ACTIVATE_SECRET,
    },
    body: JSON.stringify(request),
  });
  console.log('[API] POST', url, '->', res.status);

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    console.error('[API] POST failed', url, { status: res.status, payload });
    throw buildActivationError(res.status, payload as ApiError);
  }

  return res.json();
}
