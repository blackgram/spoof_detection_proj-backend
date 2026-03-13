/** Amount in Naira above which passkey (FIDO2) authorization is required; below this, PIN/biometric fallback is allowed. */
export const KYC_AMOUNT_THRESHOLD_NGN = 500_000;

/** Max single transfer for PoC (e.g. 1M as in AccessMore). */
export const MAX_TRANSFER_AMOUNT_NGN = 1_000_000;
