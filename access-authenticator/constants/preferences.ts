export type ThemeMode = 'system' | 'light' | 'dark';

export type CountryOption = {
  code: string;
  name: string;
  flag: string;
};

export type LanguageOption = {
  code: string;
  name: string;
  flag: string;
};

export const COUNTRIES: CountryOption[] = [
  { code: 'NG', name: 'Nigeria', flag: 'ng' },
  { code: 'GH', name: 'Ghana', flag: 'gh' },
  { code: 'KE', name: 'Kenya', flag: 'ke' },
  { code: 'ZA', name: 'South Africa', flag: 'za' },
  { code: 'US', name: 'United States', flag: 'us' },
  { code: 'GB', name: 'United Kingdom', flag: 'gb' },
];

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', flag: 'gb' },
  { code: 'fr', name: 'Français', flag: 'fr' },
  { code: 'pt', name: 'Português', flag: 'pt' },
  { code: 'es', name: 'Español', flag: 'es' },
  { code: 'ar', name: 'Arabic', flag: 'sa' },
];

export const DEFAULT_PREFS = {
  country: 'NG',
  language: 'en',
  themeMode: 'light' as ThemeMode,
  biometricEnabled: true,
  hasOnboarded: false,
};
