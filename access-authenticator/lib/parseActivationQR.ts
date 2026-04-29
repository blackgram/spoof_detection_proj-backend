import type { ChannelCode } from '@/api/totpActivation';

export type ActivationQRPayload = {
  channelUsername?: string;
  channel?: ChannelCode;
  activationCode?: string;
};

const CHANNELS = new Set<ChannelCode>(['PRIMUSPLUS', 'IBANK', 'SME']);

function normalizeChannel(input?: string | null): ChannelCode | undefined {
  if (!input) return undefined;
  const value = input.trim().toUpperCase();
  if (value === 'PRIMUS_PLUS') return 'PRIMUSPLUS';
  if (CHANNELS.has(value as ChannelCode)) return value as ChannelCode;
  return undefined;
}

function normalizeCode(input?: string | null): string | undefined {
  if (!input) return undefined;
  const value = input.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,20}$/.test(value)) return undefined;
  return value;
}

function normalizeUsername(input?: string | null): string | undefined {
  if (!input) return undefined;
  const value = input.trim();
  return value.length > 0 ? value : undefined;
}

/**
 * Parses activation QR payloads from JSON, URL query, or key=value blobs.
 * Supported forms:
 * - JSON: {"channelUsername":"john","channel":"IBANK","activationCode":"K3PX7QNB"}
 * - URL:  https://.../activate?channelUsername=john&channel=IBANK&activationCode=K3PX7QNB
 * - KV:   channelUsername=john;channel=IBANK;activationCode=K3PX7QNB
 * - RAW:  K3PX7QNB (activation code only)
 */
export function parseActivationQR(input: string): ActivationQRPayload {
  const raw = input.trim();
  if (!raw) throw new Error('QR code is empty.');

  // Raw code only.
  const rawCode = normalizeCode(raw);
  if (rawCode) return { activationCode: rawCode };

  // JSON payload.
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        channelUsername: normalizeUsername(String(parsed.channelUsername ?? parsed.username ?? '')),
        channel: normalizeChannel(String(parsed.channel ?? '')),
        activationCode: normalizeCode(String(parsed.activationCode ?? parsed.code ?? '')),
      };
    } catch {
      throw new Error('QR JSON payload is invalid.');
    }
  }

  // URL payload.
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return {
        channelUsername: normalizeUsername(url.searchParams.get('channelUsername') ?? url.searchParams.get('username')),
        channel: normalizeChannel(url.searchParams.get('channel')),
        activationCode: normalizeCode(url.searchParams.get('activationCode') ?? url.searchParams.get('code')),
      };
    } catch {
      throw new Error('QR URL payload is invalid.');
    }
  }

  // key=value payload.
  const parts = raw.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean);
  if (parts.some((item) => item.includes('='))) {
    const map = new Map<string, string>();
    for (const item of parts) {
      const [k, ...rest] = item.split('=');
      if (!k || rest.length === 0) continue;
      map.set(k.trim().toLowerCase(), rest.join('=').trim());
    }

    return {
      channelUsername: normalizeUsername(map.get('channelusername') ?? map.get('username')),
      channel: normalizeChannel(map.get('channel')),
      activationCode: normalizeCode(map.get('activationcode') ?? map.get('code')),
    };
  }

  throw new Error('Unsupported QR format.');
}
