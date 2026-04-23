import { AppState, type AppStateStatus, Platform } from 'react-native';
import { focusManager } from '@tanstack/react-query';

/** Wire app foreground/background to TanStack refetch behavior (e.g. refetchOnWindowFocus). */
export function setupReactQueryAppState(): void {
  focusManager.setEventListener((handleFocus) => {
    const onChange = (status: AppStateStatus) => {
      if (Platform.OS !== 'web') {
        handleFocus(status === 'active');
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  });
}
