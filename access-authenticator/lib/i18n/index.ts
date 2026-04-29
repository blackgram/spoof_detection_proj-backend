import { useCallback, useMemo } from 'react';

import { usePreferences } from '@/context/PreferencesContext';

import {
  DEFAULT_LANGUAGE,
  TRANSLATIONS,
  type LanguageCode,
  type TranslationDict,
} from './translations';

export type TranslateValues = Record<string, string | number>;
export type TranslateFn = (key: string, values?: TranslateValues) => string;

function interpolate(template: string, values?: TranslateValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = values[name];
    return v == null ? `{${name}}` : String(v);
  });
}

function isLanguageCode(code: string): code is LanguageCode {
  return code in TRANSLATIONS;
}

/**
 * Returns a translator function bound to the user's currently selected language.
 *
 * - Falls back to English when a key is missing in the active language.
 * - Falls back to the key itself if the key is missing entirely (helps surface typos).
 * - Updates automatically when the user changes language because it reads from PreferencesContext.
 */
export function useTranslation() {
  const { language } = usePreferences();

  const lang: LanguageCode = isLanguageCode(language) ? language : DEFAULT_LANGUAGE;

  const dict: TranslationDict = useMemo(() => TRANSLATIONS[lang], [lang]);
  const fallback: TranslationDict = TRANSLATIONS[DEFAULT_LANGUAGE];

  const t: TranslateFn = useCallback(
    (key, values) => {
      const template = dict[key] ?? fallback[key] ?? key;
      return interpolate(template, values);
    },
    [dict, fallback],
  );

  return { t, language: lang };
}

export type { LanguageCode } from './translations';
