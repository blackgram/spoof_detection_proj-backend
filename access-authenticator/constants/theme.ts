import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  type Theme,
} from '@react-navigation/native';

/** Brand palette (`Colors` alias kept for `use-theme-color` template hook) */
export const Colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#0F172A',
    textMuted: '#64748B',
    border: '#E2E8F0',
    blue: '#1D4ED8',
    blueMuted: '#3B82F6',
    orange: '#EA580C',
    orangeLight: '#F97316',
    error: '#DC2626',
  },
  dark: {
    background: '#000000',
    surface: '#0A0A0A',
    text: '#F8FAFC',
    textMuted: '#94A3B8',
    border: '#1E293B',
    orange: '#FB923C',
    orangeDeep: '#EA580C',
    blue: '#60A5FA',
    error: '#F87171',
  },
} as const;

export const palette = Colors;

export function navigationTheme(colorScheme: 'light' | 'dark'): Theme {
  if (colorScheme === 'dark') {
    return {
      ...NavDarkTheme,
      colors: {
        ...NavDarkTheme.colors,
        primary: palette.dark.orange,
        background: palette.dark.background,
        card: palette.dark.surface,
        text: palette.dark.text,
        border: palette.dark.border,
        notification: palette.dark.orangeDeep,
      },
    };
  }
  return {
    ...NavDefaultTheme,
    colors: {
      ...NavDefaultTheme.colors,
      primary: palette.light.blue,
      background: palette.light.background,
      card: palette.light.surface,
      text: palette.light.text,
      border: palette.light.border,
      notification: palette.light.orange,
    },
  };
}
