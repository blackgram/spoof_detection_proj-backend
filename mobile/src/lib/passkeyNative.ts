/**
 * Native passkey (FIDO2) adapter using react-native-passkey.
 * Converts our API request/response shapes to/from the format the native module expects.
 *
 * Requires a development build (expo run:ios / run:android). Does not work in Expo Go.
 */

import type {
  CredentialCreationOptions,
  PublicKeyCredentialAttestation,
  AssertionRequestOptions,
  AssertionResponse,
} from '../api/fido2';

/** Server options may use snake_case; native lib typically expects camelCase. */
function creationOptionsToNative(options: CredentialCreationOptions): Record<string, unknown> {
  return {
    challenge: options.challenge,
    rp: options.rp,
    user: options.user,
    pubKeyCredParams: options.pub_key_cred_params ?? options.pubKeyCredParams ?? [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    excludeCredentials: options.exclude_credentials ?? options.excludeCredentials,
    timeout: options.timeout,
    authenticatorSelection: options.authenticatorSelection ?? options.authenticator_selection,
  };
}

function assertionOptionsToNative(options: AssertionRequestOptions): Record<string, unknown> {
  return {
    challenge: options.challenge,
    allowCredentials: options.allow_credentials ?? options.allowCredentials,
    rpId: options.rpId,
    timeout: options.timeout,
  };
}

/** Normalize native registration result to our PublicKeyCredentialAttestation shape. */
function nativeRegistrationToCredential(result: Record<string, unknown>): PublicKeyCredentialAttestation {
  const response = (result.response ?? result) as Record<string, unknown>;
  return {
    id: (result.id ?? result.rawId) as string | undefined,
    rawId: (result.rawId ?? result.id) as string | undefined,
    response: {
      clientDataJSON: (response.clientDataJSON ?? response.client_data_json) as string,
      attestationObject: (response.attestationObject ?? response.attestation_object) as string,
    },
    type: (result.type as string) ?? 'public-key',
  };
}

/** Normalize native assertion result to our AssertionResponse shape. */
function nativeAssertionToResponse(result: Record<string, unknown>): AssertionResponse {
  const response = (result.response ?? result) as Record<string, unknown>;
  return {
    credentialId: (result.credentialId ?? result.rawId ?? result.id ?? response.credentialId) as string | undefined,
    rawId: (result.rawId ?? result.id) as string | undefined,
    clientDataJSON: (response.clientDataJSON ?? response.client_data_json) as string,
    authenticatorData: (response.authenticatorData ?? response.authenticator_data) as string,
    signature: (response.signature) as string,
    userHandle: (response.userHandle ?? response.user_handle) as string | undefined,
  };
}

let PasskeyModule: { create: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>; get: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>; isSupported: () => boolean } | null = null;

function loadPasskeyModule(): typeof PasskeyModule {
  if (PasskeyModule != null) return PasskeyModule;
  try {
    const mod = require('react-native-passkey');
    const Passkey = mod?.Passkey ?? mod?.default;
    PasskeyModule = Passkey;
    if (!PasskeyModule?.create || !PasskeyModule?.get) {
      console.warn('[Passkey] react-native-passkey loaded but create/get missing:', Object.keys(PasskeyModule ?? {}));
      PasskeyModule = null;
    }
    return PasskeyModule;
  } catch (e) {
    console.warn('[Passkey] Failed to load react-native-passkey (use dev build for passkeys):', e);
    return null;
  }
}

export function isPasskeySupported(): boolean {
  const P = loadPasskeyModule();
  return P?.isSupported?.() ?? false;
}

/**
 * Create a passkey (registration). Use options from registerBegin().
 * Throws if native module is not available (e.g. Expo Go) or user cancels.
 */
export async function createCredential(options: CredentialCreationOptions): Promise<PublicKeyCredentialAttestation> {
  const P = loadPasskeyModule();
  if (!P?.create) {
    const msg =
      'Passkey native module not available. Use a development build (expo run:ios or run:android); passkeys do not work in Expo Go.';
    console.warn('[Passkey] createCredential:', msg);
    throw new Error(msg);
  }
  const requestJson = creationOptionsToNative(options);
  console.log('[Passkey] createCredential: options sent to native:', {
    rpId: (requestJson.rp as { id?: string })?.id,
    rpName: (requestJson.rp as { name?: string })?.name,
    challengeLength: typeof requestJson.challenge === 'string' ? requestJson.challenge.length : 0,
    userId: (requestJson.user as { id?: string })?.id ? 'present' : 'missing',
    timeout: requestJson.timeout,
    excludeCredentialsCount: Array.isArray(requestJson.excludeCredentials) ? requestJson.excludeCredentials.length : 0,
  });
  let result: unknown;
  try {
    result = await P.create(requestJson);
    console.log('[Passkey] createCredential: native returned type=', typeof result, 'keys=', typeof result === 'object' && result !== null ? Object.keys(result as object) : 'n/a');
  } catch (nativeErr) {
    console.error('[Passkey] createCredential: native threw', nativeErr);
    throw nativeErr;
  }
  const raw = typeof result === 'string' ? (JSON.parse(result) as Record<string, unknown>) : result as Record<string, unknown>;
  if (raw?.error || (raw?.message && !raw?.response)) {
    const msg = [raw.error, raw.message].filter(Boolean).join(': ') || 'Unknown error';
    console.warn('[Passkey] createCredential native error object:', JSON.stringify(raw));
    throw new Error(msg);
  }
  console.log('[Passkey] createCredential: success, normalizing credential');
  return nativeRegistrationToCredential(raw);
}

/**
 * Get assertion (authenticate). Use options from authenticateBegin() or transaction challenge.
 * Throws if native module is not available or user cancels.
 */
export async function getAssertion(options: AssertionRequestOptions): Promise<AssertionResponse> {
  const P = loadPasskeyModule();
  if (!P?.get) {
    const msg =
      'Passkey native module not available. Use a development build (expo run:ios or run:android); passkeys do not work in Expo Go.';
    console.warn('[Passkey] getAssertion:', msg);
    throw new Error(msg);
  }
  const requestJson = assertionOptionsToNative(options);
  console.log('[Passkey] getAssertion: calling native get, rpId=', requestJson.rpId);
  let result: unknown;
  try {
    result = await P.get(requestJson);
    console.log('[Passkey] getAssertion: native returned type=', typeof result, 'keys=', typeof result === 'object' && result !== null ? Object.keys(result as object) : 'n/a');
  } catch (e) {
    console.error('[Passkey] getAssertion: native threw', e);
    throw e;
  }
  const raw = typeof result === 'string' ? (JSON.parse(result) as Record<string, unknown>) : result as Record<string, unknown>;
  if (raw?.error || (raw?.message && !raw?.clientDataJSON && !raw?.response)) {
    const msg = [raw.error, raw.message].filter(Boolean).join(': ') || 'Unknown error';
    console.warn('[Passkey] getAssertion native error object:', JSON.stringify(raw));
    throw new Error(msg);
  }
  console.log('[Passkey] getAssertion: success, normalizing');
  return nativeAssertionToResponse(raw);
}
