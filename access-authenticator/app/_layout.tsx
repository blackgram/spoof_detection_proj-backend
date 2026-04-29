import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { navigationTheme } from '@/constants/theme';
import { AuthProvider } from '@/context/AuthContext';
import { PreferencesProvider, usePreferences } from '@/context/PreferencesContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const systemColorScheme = useColorScheme() ?? 'light';
  const { themeMode, loaded: prefsLoaded } = usePreferences();
  const colorScheme = themeMode === 'system' ? systemColorScheme : themeMode;
  const theme = navigationTheme(colorScheme);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded && prefsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, prefsLoaded]);

  if (!fontsLoaded || !prefsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={theme}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="onboarding-success" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="token" />
            <Stack.Screen
              name="add-token"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="scan"
              options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="manual-setup"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <RootLayoutContent />
    </PreferencesProvider>
  );
}
