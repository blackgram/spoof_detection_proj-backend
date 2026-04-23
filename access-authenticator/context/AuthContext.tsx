import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getTotpAccount,
  saveTotpAccount,
  clearTotpAccount,
  type TotpAccount,
} from '@/lib/secureStore';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import { registerPushToken } from '@/api/pushAuth';

export type User = {
  email: string;
  name: string;
};

type AuthContextValue = {
  user: User | null;
  totpAccount: TotpAccount | null;
  isTokenSetup: boolean;
  signIn: (email: string, password: string) => void;
  signUp: (name: string, email: string, password: string) => void;
  signOut: () => void;
  setupToken: (account: TotpAccount) => Promise<void>;
  removeToken: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [totpAccount, setTotpAccount] = useState<TotpAccount | null>(null);
  const router = useRouter();

  // Load stored TOTP account on mount
  useEffect(() => {
    getTotpAccount().then(setTotpAccount);
  }, []);

  const signIn = useCallback(
    (email: string, _password: string) => {
      const local = email.trim().split('@')[0] ?? 'User';
      setUser({
        email: email.trim(),
        name: local.charAt(0).toUpperCase() + local.slice(1),
      });
      router.replace('/(tabs)');
    },
    [router]
  );

  const signUp = useCallback(
    (name: string, email: string, _password: string) => {
      setUser({
        email: email.trim(),
        name: name.trim() || 'User',
      });
      router.replace('/(tabs)');
    },
    [router]
  );

  const signOut = useCallback(async () => {
    setUser(null);
    router.replace('/(auth)/login');
  }, [router]);

  const setupToken = useCallback(async (account: TotpAccount) => {
    await saveTotpAccount(account);
    setTotpAccount(account);

    // Register push token on backend
    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        await registerPushToken(account.username, pushToken);
      }
    } catch (e) {
      if (__DEV__) console.warn('[Setup] Push registration failed:', e);
    }
  }, []);

  const removeToken = useCallback(async () => {
    await clearTotpAccount();
    setTotpAccount(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      totpAccount,
      isTokenSetup: totpAccount !== null,
      signIn,
      signUp,
      signOut,
      setupToken,
      removeToken,
    }),
    [user, totpAccount, signIn, signUp, signOut, setupToken, removeToken]
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
