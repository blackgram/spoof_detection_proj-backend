import * as SecureStore from 'expo-secure-store';

const TOTP_ACCOUNTS_KEY = 'accessauth_totp_accounts';
const LEGACY_TOTP_ACCOUNT_KEY = 'accessauth_totp_account';

export interface TotpAccount {
  id: string;
  username: string;
  issuer: string;
  label: string;
  secret: string;
  createdAt: number;
  channel?: 'PRIMUSPLUS' | 'IBANK' | 'SME';
  channelUsername?: string;
  keycloakUserId?: string;
  keycloakUsername?: string;
  color?: string;
  icon?: string;
  tokenType?: 'Corporate' | 'Retail';
}

/**
 * Read all stored TOTP accounts.
 * Includes one-time migration from legacy single-token storage.
 */
export async function getTotpAccounts(): Promise<TotpAccount[]> {
  const raw = await SecureStore.getItemAsync(TOTP_ACCOUNTS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as TotpAccount[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }

  // Migrate old single-token storage if present.
  const legacyRaw = await SecureStore.getItemAsync(LEGACY_TOTP_ACCOUNT_KEY);
  if (!legacyRaw) return [];
  try {
    const legacy = JSON.parse(legacyRaw) as {
      username: string;
      issuer: string;
      label: string;
      secret: string;
    };
    if (!legacy?.secret) return [];
    const migrated: TotpAccount = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      username: legacy.username,
      issuer: legacy.issuer,
      label: legacy.label,
      secret: legacy.secret,
      createdAt: Date.now(),
    };
    await SecureStore.setItemAsync(TOTP_ACCOUNTS_KEY, JSON.stringify([migrated]));
    await SecureStore.deleteItemAsync(LEGACY_TOTP_ACCOUNT_KEY);
    return [migrated];
  } catch {
    return [];
  }
}

export async function saveTotpAccounts(accounts: TotpAccount[]): Promise<void> {
  await SecureStore.setItemAsync(TOTP_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export async function clearTotpAccounts(): Promise<void> {
  await SecureStore.deleteItemAsync(TOTP_ACCOUNTS_KEY);
  await SecureStore.deleteItemAsync(LEGACY_TOTP_ACCOUNT_KEY);
}
