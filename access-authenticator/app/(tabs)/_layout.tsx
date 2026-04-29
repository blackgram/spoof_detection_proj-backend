import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { Platform } from 'react-native';

import { useIsDarkMode } from '@/hooks/use-app-colors';
import { palette } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

export default function TabLayout() {
  const theme = useTheme();
  const isDark = useIsDarkMode();
  const { t } = useTranslation();

  const activeTint = isDark ? palette.dark.primary : palette.light.primary;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: isDark ? '#505060' : '#9090A0',
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          ...(Platform.OS === 'android' && { paddingBottom: 10, height: 68 }),
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: t('tabs.authorizations'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
