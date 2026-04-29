import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

import { DEFAULT_PREFS, type ThemeMode } from '@/constants/preferences';

type PreferencesState = {
  country: string;
  language: string;
  themeMode: ThemeMode;
  biometricEnabled: boolean;
  hasOnboarded: boolean;
};

type PreferencesContextValue = PreferencesState & {
  loaded: boolean;
  setCountry: (country: string) => void;
  setLanguage: (language: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  completeOnboarding: (country: string, language: string) => void;
  resetPreferences: () => void;
};

const PREFS_KEY = 'accessauth_app_preferences';

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

async function loadPrefs(): Promise<PreferencesState> {
  const raw = await SecureStore.getItemAsync(PREFS_KEY);
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<PreferencesState>;
    const hasOnboarded = parsed.hasOnboarded ?? true;
    return {
      country: parsed.country ?? DEFAULT_PREFS.country,
      language: parsed.language ?? DEFAULT_PREFS.language,
      themeMode: parsed.themeMode ?? DEFAULT_PREFS.themeMode,
      biometricEnabled: parsed.biometricEnabled ?? DEFAULT_PREFS.biometricEnabled,
      hasOnboarded,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: PreferencesState) {
  return SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<PreferencesState>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadPrefs()
      .then((next) => {
        if (!active) return;
        setPrefs(next);
      })
      .finally(() => {
        if (!active) return;
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const updatePrefs = (update: Partial<PreferencesState>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...update };
      void savePrefs(next);
      return next;
    });
  };

  const value = useMemo(
    () => ({
      ...prefs,
      loaded,
      setCountry: (country: string) => updatePrefs({ country }),
      setLanguage: (language: string) => updatePrefs({ language }),
      setThemeMode: (themeMode: ThemeMode) => updatePrefs({ themeMode }),
      setBiometricEnabled: (biometricEnabled: boolean) => updatePrefs({ biometricEnabled }),
      completeOnboarding: (country: string, language: string) =>
        updatePrefs({ country, language, hasOnboarded: true }),
      resetPreferences: () => {
        setPrefs(DEFAULT_PREFS);
        void savePrefs(DEFAULT_PREFS);
      },
    }),
    [loaded, prefs],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return ctx;
}
