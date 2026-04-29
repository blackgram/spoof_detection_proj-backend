import { Redirect } from 'expo-router';
import { usePreferences } from '@/context/PreferencesContext';

export default function Index() {
  const { loaded, hasOnboarded } = usePreferences();

  if (!loaded) return null;

  if (!hasOnboarded) {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}
