import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const DEVICE_ID_KEY = 'accessmore_device_id';
const USER_KEY = 'accessmore_user';
const KYC_KEY = 'accessmore_kyc_completed';
const CUSTOMER_ID_KEY = 'accessmore_customer_id';
const BIOMETRIC_PROFILES_KEY = 'accessmore_biometric_profiles';
const LAST_USERNAME_KEY = 'accessmore_last_username';

export interface BiometricProfile {
  customerId: string;
  hasBiometrics: boolean;
}

export interface User {
  userId: string;
  name: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  kycCompleted: boolean;
  customerId: string | null; // From backend after KYC onboarding
  deviceChanged: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  /** Device-key + biometric login; requires username to have completed "Enable biometrics" (KYC + device key register). */
  loginWithBiometrics: (username: string) => Promise<void>;
  getProfile: (username: string) => Promise<BiometricProfile | null>;
  setBiometricsForUsername: (username: string, customerId: string) => Promise<void>;
  clearBiometricsForUsername: (username: string) => Promise<void>;
  getLastUsername: () => Promise<string | null>;
  logout: () => Promise<void>;
  completeKYC: () => Promise<void>;
  completeKYCWithCustomerId: (customerId: string) => Promise<void>;
  clearDeviceChangeFlag: () => Promise<void>;
  checkDeviceAndAuth: () => Promise<{ deviceChanged: boolean }>;
  getDeviceId: () => string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getDeviceFingerprint(): string {
  // PoC: use installationId or a stable device identifier. In production would use FIDO2 attestation.
  const id = Constants.installationId ?? Constants.sessionId ?? 'unknown';
  return id;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [kycCompleted, setKycCompletedState] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [deviceChanged, setDeviceChanged] = useState(false);

  const loadStoredAuth = useCallback(async () => {
    try {
      const storedUser = await SecureStore.getItemAsync(USER_KEY);
      const storedDeviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      const storedKyc = await SecureStore.getItemAsync(KYC_KEY);
      const storedCustomerId = await SecureStore.getItemAsync(CUSTOMER_ID_KEY);

      if (storedUser) {
        const u = JSON.parse(storedUser) as User;
        setUser(u);
        setKycCompletedState(storedKyc === 'true');
        setCustomerId(storedCustomerId);

        const currentDeviceId = getDeviceFingerprint();
        if (storedDeviceId && storedDeviceId !== currentDeviceId) {
          setDeviceChanged(true);
        }
      } else {
        setUser(null);
        setKycCompletedState(false);
        setCustomerId(null);
        setDeviceChanged(false);
      }
    } catch (e) {
      console.warn('Auth load error', e);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  const getProfile = useCallback(async (username: string): Promise<BiometricProfile | null> => {
    try {
      const raw = await SecureStore.getItemAsync(BIOMETRIC_PROFILES_KEY);
      if (!raw) return null;
      const map = JSON.parse(raw) as Record<string, BiometricProfile>;
      return map[username.trim()] ?? null;
    } catch {
      return null;
    }
  }, []);

  const setBiometricsForUsername = useCallback(async (username: string, customerId: string) => {
    const key = username.trim();
    if (!key) return;
    try {
      const raw = await SecureStore.getItemAsync(BIOMETRIC_PROFILES_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, BiometricProfile>) : {};
      map[key] = { customerId, hasBiometrics: true };
      await SecureStore.setItemAsync(BIOMETRIC_PROFILES_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('setBiometricsForUsername failed', e);
    }
  }, []);

  const clearBiometricsForUsername = useCallback(async (username: string) => {
    const key = username.trim();
    if (!key) return;
    try {
      const raw = await SecureStore.getItemAsync(BIOMETRIC_PROFILES_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, BiometricProfile>) : {};
      if (map[key]) {
        map[key] = { ...map[key], hasBiometrics: false };
        await SecureStore.setItemAsync(BIOMETRIC_PROFILES_KEY, JSON.stringify(map));
      }
    } catch (e) {
      console.warn('clearBiometricsForUsername failed', e);
    }
  }, []);

  const getLastUsername = useCallback(async (): Promise<string | null> => {
    return SecureStore.getItemAsync(LAST_USERNAME_KEY);
  }, []);

  const login = useCallback(async (username: string, _password: string) => {
    const name = username.trim() || 'User';
    const deviceId = getDeviceFingerprint();

    // Ensure a Firestore customer exists for this username (create if new)
    let customerIdToStore: string | null = null;
    try {
      const { ensureCustomerByUsername } = await import('../api/customers');
      const { customer_id } = await ensureCustomerByUsername(name);
      customerIdToStore = customer_id;
    } catch (e) {
      console.warn('[Auth] ensureCustomerByUsername failed (offline?):', e);
    }

    const userData: User = { userId: customerIdToStore || `user_${Date.now()}`, name };
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    await SecureStore.setItemAsync(LAST_USERNAME_KEY, name);
    if (customerIdToStore) {
      await SecureStore.setItemAsync(CUSTOMER_ID_KEY, customerIdToStore);
      setCustomerId(customerIdToStore);
    } else {
      const existingCustomerId = await SecureStore.getItemAsync(CUSTOMER_ID_KEY);
      setCustomerId(existingCustomerId);
    }
    setUser(userData);
    setDeviceChanged(false);
    const existingKyc = await SecureStore.getItemAsync(KYC_KEY);
    setKycCompletedState(existingKyc === 'true');
  }, []);

  const loginWithBiometrics = useCallback(
    async (username: string) => {
      console.log('[Auth] loginWithBiometrics: start username=', username);
      const profile = await getProfile(username);
      if (!profile?.hasBiometrics || !profile.customerId) {
        throw new Error('Biometrics not set up for this account. Sign in with password and enable biometrics first.');
      }
      console.log('[Auth] loginWithBiometrics: profile OK customerId=', profile.customerId, '→ step 1: getChallenge');
      const { getChallenge, verifyChallenge } = await import('../api/deviceAuth');
      const { signChallengeAfterBiometrics } = await import('../lib/deviceKey');
      const { challenge } = await getChallenge(profile.customerId);
      console.log('[Auth] loginWithBiometrics: step 2: sign (biometric prompt)');
      const signature = await signChallengeAfterBiometrics(challenge);
      console.log('[Auth] loginWithBiometrics: step 3: verify');
      const { getDeviceName } = await import('../lib/deviceInfo');
      const deviceName = getDeviceName();
      await verifyChallenge(profile.customerId, challenge, signature, deviceName);
      console.log('[Auth] loginWithBiometrics: step 4: success, updating session state');
      const userData: User = { userId: profile.customerId, name: username.trim() };
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
      await SecureStore.setItemAsync(DEVICE_ID_KEY, getDeviceFingerprint());
      await SecureStore.setItemAsync(LAST_USERNAME_KEY, username.trim());
      await SecureStore.setItemAsync(CUSTOMER_ID_KEY, profile.customerId);
      await SecureStore.setItemAsync(KYC_KEY, 'true');
      setUser(userData);
      setCustomerId(profile.customerId);
      setKycCompletedState(true);
      setDeviceChanged(false);
    },
    [getProfile]
  );

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
    await SecureStore.deleteItemAsync(KYC_KEY);
    await SecureStore.deleteItemAsync(CUSTOMER_ID_KEY);
    setUser(null);
    setKycCompletedState(false);
    setCustomerId(null);
    setDeviceChanged(false);
  }, []); // Note: we do not clear BIOMETRIC_PROFILES_KEY or LAST_USERNAME_KEY on logout so profiles and prefill persist

  const completeKYC = useCallback(async () => {
    await SecureStore.setItemAsync(KYC_KEY, 'true');
    setKycCompletedState(true);
    setDeviceChanged(false);
    if (user) {
      await SecureStore.setItemAsync(DEVICE_ID_KEY, getDeviceFingerprint());
    }
  }, [user]);

  const completeKYCWithCustomerId = useCallback(async (cid: string) => {
    await SecureStore.setItemAsync(CUSTOMER_ID_KEY, cid);
    await SecureStore.setItemAsync(KYC_KEY, 'true');
    setCustomerId(cid);
    setKycCompletedState(true);
    setDeviceChanged(false);
    if (user) {
      await SecureStore.setItemAsync(DEVICE_ID_KEY, getDeviceFingerprint());
    }
  }, [user]);

  const clearDeviceChangeFlag = useCallback(async () => {
    setDeviceChanged(false);
  }, []);

  const checkDeviceAndAuth = useCallback(async (): Promise<{ deviceChanged: boolean }> => {
    const storedDeviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    const currentDeviceId = getDeviceFingerprint();
    const changed = !!(storedDeviceId && storedDeviceId !== currentDeviceId);
    setDeviceChanged(changed);
    return { deviceChanged: changed };
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    kycCompleted,
    customerId,
    deviceChanged,
    login,
    loginWithBiometrics,
    getProfile,
    setBiometricsForUsername,
    clearBiometricsForUsername,
    getLastUsername,
    logout,
    completeKYC,
    completeKYCWithCustomerId,
    clearDeviceChangeFlag,
    checkDeviceAndAuth,
    getDeviceId: getDeviceFingerprint,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
