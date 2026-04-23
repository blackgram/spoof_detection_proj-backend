declare module '@noble/hashes/hmac' {
  import type { Hash } from '@noble/hashes';
  export function hmac(hash: Hash<any>, key: Uint8Array, message: Uint8Array): Uint8Array;
}

declare module '@noble/hashes/legacy' {
  import type { Hash } from '@noble/hashes';
  export const sha1: Hash<any>;
}
