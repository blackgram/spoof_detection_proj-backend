"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";

const STORAGE_KEY = "ibank_session_v1";

export interface AuthUser {
  customer_id: string;
  username: string;
  name: string;
  accounts: api.Account[];
}

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccounts: () => Promise<void>;
  setUserFromSession: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser;
        if (parsed?.customer_id && parsed?.username) {
          setUser(parsed);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  const persist = useCallback((u: AuthUser | null) => {
    if (typeof window === "undefined") return;
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await api.login(username, password);
      const next: AuthUser = {
        customer_id: data.customer_id,
        username: data.username,
        name: data.name,
        accounts: data.accounts,
      };
      setUser(next);
      persist(next);
    },
    [persist]
  );

  const setUserFromSession = useCallback(
    (u: AuthUser) => {
      setUser(u);
      persist(u);
    },
    [persist]
  );

  const logout = useCallback(() => {
    setUser(null);
    persist(null);
    router.push("/");
  }, [persist, router]);

  const refreshAccounts = useCallback(async () => {
    if (!user?.customer_id) return;
    const accounts = await api.getAccounts(user.customer_id);
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, accounts };
      persist(next);
      return next;
    });
  }, [user?.customer_id, persist]);

  const value = useMemo(
    () => ({
      user,
      ready,
      login,
      logout,
      refreshAccounts,
      setUserFromSession,
    }),
    [user, ready, login, logout, refreshAccounts, setUserFromSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
