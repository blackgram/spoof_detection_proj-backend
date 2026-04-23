import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '@react-navigation/native';

import { useIsDarkMode } from '@/hooks/use-app-colors';

export default function TabLayout() {
  const theme = useTheme();
  const isDark = useIsDarkMode();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        tabBarActiveTintColor: "#EA580C",
        tabBarInactiveTintColor: isDark ? '#64748B' : '#94A3B8',
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="token"
        options={{
          title: 'Token',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="lock-closed" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: 'Authorizations',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
