export type ThemeMode = 'system' | 'light' | 'dark';

export type CountryOption = {
  code: string;
  name: string;
  flag: string;
};

export type LanguageOption = {
  code: string;
  name: string;
};

export const COUNTRIES: CountryOption[] = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
];

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Francais' },
  { code: 'pt', name: 'Portugues' },
  { code: 'es', name: 'Espanol' },
  { code: 'ar', name: 'Arabic' },
];

export const DEFAULT_PREFS = {
  country: 'NG',
  language: 'en',
  themeMode: 'system' as ThemeMode,
  biometricEnabled: true,
  hasOnboarded: false,
};
