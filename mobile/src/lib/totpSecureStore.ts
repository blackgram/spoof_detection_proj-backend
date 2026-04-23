/**
 * Single source of truth for software TOTP accounts in SecureStore.
 * Must be cleared when the authenticated customer changes or on logout.
 */
import * as SecureStore from 'expo-secure-store';

export const TOTP_ACCOUNTS_KEY = 'accessmore_totp_accounts';

export async function clearTotpAccounts(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOTP_ACCOUNTS_KEY);
  } catch {
    /* ignore */
  }
}
