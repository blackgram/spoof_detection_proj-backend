/**
 * TOTP (RFC 6238) generation using @noble/hashes (already installed).
 * Compatible with Google Authenticator, Microsoft Authenticator, Entrust, etc.
 */

import { hmac } from '@noble/hashes/hmac';
import { sha1 } from '@noble/hashes/sha1';

const PERIOD = 30;
const DIGITS = 6;
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Uint8Array {
  const cleaned = input.replace(/[\s=-]/g, '').toUpperCase();
  const bits: number[] = [];
  for (const ch of cleaned) {
    const val = BASE32_CHARS.indexOf(ch);
    if (val === -1) continue;
    for (let i = 4; i >= 0; i--) bits.push((val >> i) & 1);
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    bytes[i] = byte;
  }
  return bytes;
}

function intToBytes(num: number): Uint8Array {
  const buf = new Uint8Array(8);
  let n = num;
  for (let i = 7; i >= 0; i--) {
    buf[i] = n & 0xff;
    n = Math.floor(n / 256);
  }
  return buf;
}

/**
 * Generate a TOTP code for a given base32-encoded secret.
 * Returns { code, remainingSeconds, period }.
 */
export function generateTOTP(secretBase32: string): {
  code: string;
  remainingSeconds: number;
  period: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(now / PERIOD);
  const remaining = PERIOD - (now % PERIOD);

  const key = base32Decode(secretBase32);
  const msg = intToBytes(timeStep);
  const hash = hmac(sha1, key, msg);

  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 10 ** DIGITS;
  const code = otp.toString().padStart(DIGITS, '0');

  return { code, remainingSeconds: remaining, period: PERIOD };
}

/**
 * Generate a random base32 secret (20 bytes = 160 bits, standard for TOTP).
 */
export function generateSecret(): string {
  const bytes = new Uint8Array(20);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  let bits = '';
  for (const b of bytes) {
    bits += b.toString(2).padStart(8, '0');
  }
  let result = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    const idx = parseInt(bits.slice(i, i + 5), 2);
    result += BASE32_CHARS[idx];
  }
  return result;
}

export { PERIOD, DIGITS };
