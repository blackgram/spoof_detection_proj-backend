/**
 * AccessMore-style theme: black background with orange accents.
 * Consistent across all screens for a cohesive banking app look.
 */
export const colors = {
  // Backgrounds – deep black
  background: '#0a0a0a',
  backgroundElevated: '#111111',
  card: '#141414',
  cardBorder: '#262626',

  // Text
  text: '#ffffff',
  textSecondary: '#a3a3a3',
  textMuted: '#737373',

  // Brand – orange
  primary: '#f97316',
  primaryPressed: '#ea580c',
  primaryMuted: 'rgba(249, 115, 22, 0.18)',
  primaryGlow: 'rgba(249, 115, 22, 0.35)',

  // Status (kept readable on dark)
  success: '#22c55e',
  successMuted: 'rgba(34, 197, 94, 0.2)',
  error: '#ef4444',
  errorMuted: 'rgba(239, 68, 68, 0.2)',
  errorBg: 'rgba(239, 68, 68, 0.12)',
  warning: '#f59e0b',

  // UI
  border: '#262626',
  inputBg: '#171717',
  disabled: '#404040',
  overlay: 'rgba(0, 0, 0, 0.7)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const },
  titleSm: { fontSize: 18, fontWeight: '700' as const },
  subtitle: { fontSize: 16, fontWeight: '500' as const },
  body: { fontSize: 15 },
  caption: { fontSize: 13 },
  small: { fontSize: 11 },
} as const;
