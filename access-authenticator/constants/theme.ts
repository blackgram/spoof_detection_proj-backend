import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  type Theme,
} from '@react-navigation/native';

/** Brand palette matching the Access Authenticator UX Design */
export const Colors = {
  light: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    text: '#0A0A0F',
    textMuted: '#717182',
    border: 'rgba(0,0,0,0.10)',
    primary: '#003883',
    orange: '#FF8200',
    orangeLight: '#FFF3E0',
    accent: '#E8F0FE',
    accentForeground: '#003883',
    muted: '#ececf0',
    inputBackground: '#f3f3f5',
    error: '#d4183d',
    // kept for backwards compat in any screen that still refs c.blue
    blue: '#003883',
    blueMuted: '#003883',
  },
  dark: {
    background: '#0A0A0F',
    surface: '#18181f',
    text: '#F5F5FA',
    textMuted: '#9090A0',
    border: 'rgba(255,255,255,0.10)',
    primary: '#FF8200',
    orange: '#FF8200',
    orangeLight: '#2A1800',
    accent: '#1a2540',
    accentForeground: '#93b4ff',
    muted: '#1e1e2a',
    inputBackground: '#1e1e2a',
    error: '#f04060',
    blue: '#93b4ff',
    blueMuted: '#93b4ff',
  },
} as const;

export const palette = Colors;

export function navigationTheme(colorScheme: 'light' | 'dark'): Theme {
  if (colorScheme === 'dark') {
    return {
      ...NavDarkTheme,
      colors: {
        ...NavDarkTheme.colors,
        primary: palette.dark.primary,
        background: palette.dark.background,
        card: palette.dark.surface,
        text: palette.dark.text,
        border: palette.dark.border,
        notification: palette.dark.orange,
      },
    };
  }
  return {
    ...NavDefaultTheme,
    colors: {
      ...NavDefaultTheme.colors,
      primary: palette.light.primary,
      background: palette.light.background,
      card: palette.light.surface,
      text: palette.light.text,
      border: palette.light.border,
      notification: palette.light.orange,
    },
  };
}
