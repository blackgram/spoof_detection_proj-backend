import { palette } from '@/constants/theme';
import { usePreferences } from '@/context/PreferencesContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

function useResolvedTheme() {
  const systemScheme = useColorScheme() ?? 'light';
  const { themeMode } = usePreferences();
  return themeMode === 'system' ? systemScheme : themeMode;
}

export function useAppColors() {
  const scheme = useResolvedTheme();
  return scheme === 'dark' ? palette.dark : palette.light;
}

export function useIsDarkMode() {
  return useResolvedTheme() === 'dark';
}
