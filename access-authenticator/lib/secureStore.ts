/**
 * Secure storage for a single TOTP account.
 * One token per app instance — account number is the unique identifier.
 */
import * as SecureStore from 'expo-secure-store';

const TOTP_ACCOUNT_KEY = 'accessauth_totp_account';

export interface TotpAccount {
  username: string;
  issuer: string;
  label: string;
  secret: string;
}

export async function getTotpAccount(): Promise<TotpAccount | null> {
  const raw = await SecureStore.getItemAsync(TOTP_ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TotpAccount;
  } catch {
    return null;
  }
}

export async function saveTotpAccount(account: TotpAccount): Promise<void> {
  await SecureStore.setItemAsync(TOTP_ACCOUNT_KEY, JSON.stringify(account));
}

export async function clearTotpAccount(): Promise<void> {
  await SecureStore.deleteItemAsync(TOTP_ACCOUNT_KEY);
}
