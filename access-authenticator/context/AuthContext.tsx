import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  getTotpAccounts,
  saveTotpAccounts,
  clearTotpAccounts,
  type TotpAccount,
} from '@/lib/secureStore';
import { usePreferences } from '@/context/PreferencesContext';

type AuthContextValue = {
  totpAccounts: TotpAccount[];
  totpAccount: TotpAccount | null;
  isTokenSetup: boolean;
  isBiometricLocked: boolean;
  getTokenById: (id: string) => TotpAccount | null;
  unlockWithBiometrics: () => Promise<boolean>;
  lockBiometricGate: () => void;
  setupToken: (account: Omit<TotpAccount, 'id' | 'createdAt'>) => Promise<void>;
  removeToken: (id: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [totpAccounts, setTotpAccounts] = useState<TotpAccount[]>([]);
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const totpAccountsRef = useRef<TotpAccount[]>([]);
  const appStateRef = useRef(AppState.currentState);
  const authInProgressRef = useRef(false);
  const lastUnlockAtRef = useRef(0);
  const { biometricEnabled, loaded: prefsLoaded } = usePreferences();

  // Load stored TOTP account on mount
  useEffect(() => {
    getTotpAccounts().then(setTotpAccounts);
  }, []);

  useEffect(() => {
    totpAccountsRef.current = totpAccounts;
  }, [totpAccounts]);

  const totpAccount = totpAccounts[0] ?? null;

  // Sync lock state with persisted settings/token state.
  useEffect(() => {
    if (!prefsLoaded) return;
    setIsBiometricLocked(Boolean(biometricEnabled && totpAccounts.length > 0));
  }, [prefsLoaded, biometricEnabled, totpAccounts.length]);

  // Relock when app returns from background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackgrounded = appStateRef.current.match(/inactive|background/) != null;
      const withinUnlockGracePeriod = Date.now() - lastUnlockAtRef.current < 1500;
      if (
        wasBackgrounded &&
        nextState === 'active' &&
        biometricEnabled &&
        totpAccounts.length > 0 &&
        !authInProgressRef.current &&
        !withinUnlockGracePeriod
      ) {
        setIsBiometricLocked(true);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [biometricEnabled, totpAccounts.length]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!biometricEnabled || totpAccounts.length === 0) {
      setIsBiometricLocked(false);
      return true;
    }

    try {
      authInProgressRef.current = true;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify identity',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsBiometricLocked(false);
        lastUnlockAtRef.current = Date.now();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      authInProgressRef.current = false;
    }
  }, [biometricEnabled, totpAccounts.length]);

  const lockBiometricGate = useCallback(() => {
    if (!biometricEnabled || totpAccounts.length === 0) return;
    setIsBiometricLocked(true);
  }, [biometricEnabled, totpAccounts.length]);

  const setupToken = useCallback(async (account: Omit<TotpAccount, 'id' | 'createdAt'>) => {
    const nextAccount: TotpAccount = {
      ...account,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    const next = [...totpAccountsRef.current, nextAccount];
    await saveTotpAccounts(next);
    setTotpAccounts(next);
  }, []);

  const removeToken = useCallback(async (id: string) => {
    const next = totpAccountsRef.current.filter((item) => item.id !== id);
    if (next.length === 0) {
      await clearTotpAccounts();
      setTotpAccounts([]);
      setIsBiometricLocked(false);
      return;
    }
    await saveTotpAccounts(next);
    setTotpAccounts(next);
  }, []);

  const getTokenById = useCallback((id: string) => {
    return totpAccounts.find((item) => item.id === id) ?? null;
  }, [totpAccounts]);

  const value = useMemo(
    () => ({
      totpAccounts,
      totpAccount,
      isTokenSetup: totpAccounts.length > 0,
      isBiometricLocked,
      getTokenById,
      unlockWithBiometrics,
      lockBiometricGate,
      setupToken,
      removeToken,
    }),
    [
      totpAccounts,
      totpAccount,
      isBiometricLocked,
      getTokenById,
      unlockWithBiometrics,
      lockBiometricGate,
      setupToken,
      removeToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
