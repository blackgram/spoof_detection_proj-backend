import { useColorScheme } from 'react-native';

import { palette } from '@/constants/theme';

export function useAppColors() {
  const scheme = useColorScheme() ?? 'light';
  return scheme === 'dark' ? palette.dark : palette.light;
}

export function useIsDarkMode() {
  return (useColorScheme() ?? 'light') === 'dark';
}
