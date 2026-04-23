/**
 * Parse a QR code payload into TOTP account setup data.
 *
 * Supports standard otpauth:// URIs:
 *   otpauth://totp/{issuer}:{label}?secret={base32}&account={accountNumber}
 *
 * The `account` query param carries the bank account number used as the
 * unique identifier on our backend.
 */

export interface QRPayload {
  issuer: string;
  label: string;
  secret: string;
  username: string;
}

export function parseOtpauthURI(uri: string): QRPayload {
  const url = new URL(uri);
  if (url.protocol !== 'otpauth:') {
    throw new Error('Invalid QR code: expected otpauth:// URI');
  }
  if (url.hostname !== 'totp') {
    throw new Error('Only TOTP tokens are supported');
  }

  // Path is /{issuer}:{label} or just /{label}
  const path = decodeURIComponent(url.pathname.replace(/^\//, ''));
  let issuer: string;
  let label: string;

  if (path.includes(':')) {
    const idx = path.indexOf(':');
    issuer = path.slice(0, idx).trim();
    label = path.slice(idx + 1).trim();
  } else {
    issuer = url.searchParams.get('issuer') ?? 'Unknown';
    label = path.trim();
  }

  // Override issuer with query param if present
  const qIssuer = url.searchParams.get('issuer');
  if (qIssuer) issuer = qIssuer;

  const secret = url.searchParams.get('secret');
  if (!secret) {
    throw new Error('QR code missing TOTP secret');
  }

  return { issuer, label, secret: secret.toUpperCase(), username: label };
}
