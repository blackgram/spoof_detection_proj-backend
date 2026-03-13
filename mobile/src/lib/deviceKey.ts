/**
 * Device-bound Ed25519 key: generate, store in SecureStore, sign after local biometrics.
 * Used for login and transaction authorization (no passkeys).
 */

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// React Native: polyfills for @noble/ed25519 (no crypto.subtle)
import 'react-native-get-random-values';

// Use pure-JS SHA-512 so we don't need crypto.subtle (not available in RN)
ed.etc.sha512Sync = (...messages: Uint8Array[]) => sha512(ed.etc.concatBytes(...messages));
ed.etc.sha512Async = async (...messages: Uint8Array[]) => Promise.resolve(ed.etc.sha512Sync!(...messages));

const DEVICE_PRIVATE_KEY_KEY = 'accessmore_device_private_key';
const LOG_PREFIX = '[DeviceKey]';

/** Base64url encode (no +/ or padding) for Uint8Array. Uses btoa (available in RN/Expo). */
function b64Encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const base64 = btoa(bin);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64url decode to Uint8Array. */
function b64Decode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
  const bin = atob(base64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Generate a new Ed25519 key pair. Returns public key (base64) and stores private key in SecureStore.
 * Call this when enabling biometrics (after KYC); then register the public key with the backend.
 */
export async function generateAndStoreKey(): Promise<{ publicKeyB64: string }> {
  console.log(`${LOG_PREFIX} generateAndStoreKey: generating Ed25519 key pair...`);
  const secretKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(secretKey);
  const privB64 = b64Encode(secretKey);
  const pubB64 = b64Encode(publicKey);
  await SecureStore.setItemAsync(DEVICE_PRIVATE_KEY_KEY, privB64);
  console.log(`${LOG_PREFIX} generateAndStoreKey: done. public_key_len=${pubB64.length} (32 bytes), private key stored in SecureStore`);
  return { publicKeyB64: pubB64 };
}

/**
 * Whether a device private key is stored (user has enabled device-key biometrics on this device).
 */
export async function hasDeviceKey(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(DEVICE_PRIVATE_KEY_KEY);
  return !!stored;
}

/**
 * Sign a challenge (base64) after prompting for local biometrics.
 * Returns signature as base64. Throws if user cancels or key missing.
 */
export async function signChallengeAfterBiometrics(challengeB64: string): Promise<string> {
  console.log(`${LOG_PREFIX} signChallengeAfterBiometrics: challenge_len=${challengeB64?.length ?? 0}, loading key...`);
  const privB64 = await SecureStore.getItemAsync(DEVICE_PRIVATE_KEY_KEY);
  if (!privB64) {
    console.log(`${LOG_PREFIX} signChallengeAfterBiometrics: no device key in SecureStore`);
    throw new Error('No device key. Enable biometrics in Settings first.');
  }
  console.log(`${LOG_PREFIX} signChallengeAfterBiometrics: prompting biometrics...`);
  const { success } = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to continue',
    fallbackLabel: 'Use PIN',
  });
  if (!success) {
    console.log(`${LOG_PREFIX} signChallengeAfterBiometrics: user cancelled or failed`);
    throw new Error('Authentication cancelled or failed');
  }
  const secretKey = b64Decode(privB64);
  const message = b64Decode(challengeB64);
  console.log(`${LOG_PREFIX} signChallengeAfterBiometrics: signing message (${message.length} bytes)...`);
  const signature = await ed.signAsync(message, secretKey);
  const sigB64 = b64Encode(signature);
  console.log(`${LOG_PREFIX} signChallengeAfterBiometrics: done. signature_len=${sigB64.length} (64 bytes)`);
  return sigB64;
}

/**
 * Sign raw bytes (e.g. transaction challenge hash). Use after biometrics.
 * Used for transaction-verify where server sends challenge as base64 of hash.
 */
export async function signBytesAfterBiometrics(messageBytes: Uint8Array): Promise<string> {
  console.log(`${LOG_PREFIX} signBytesAfterBiometrics: message_len=${messageBytes?.length ?? 0}, loading key...`);
  const privB64 = await SecureStore.getItemAsync(DEVICE_PRIVATE_KEY_KEY);
  if (!privB64) {
    throw new Error('No device key. Enable biometrics in Settings first.');
  }
  console.log(`${LOG_PREFIX} signBytesAfterBiometrics: prompting biometrics...`);
  const { success } = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to authorize transfer',
    fallbackLabel: 'Use PIN',
  });
  if (!success) {
    throw new Error('Authentication cancelled or failed');
  }
  const secretKey = b64Decode(privB64);
  const signature = await ed.signAsync(messageBytes, secretKey);
  const sigB64 = b64Encode(signature);
  console.log(`${LOG_PREFIX} signBytesAfterBiometrics: done. signature_len=${sigB64.length}`);
  return sigB64;
}

/**
 * Remove stored device key (e.g. when user disables biometrics).
 */
export async function clearDeviceKey(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_PRIVATE_KEY_KEY);
}
