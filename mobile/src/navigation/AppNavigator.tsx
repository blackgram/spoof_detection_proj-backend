import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import TransferScreen from '../screens/TransferScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LimitScreen from '../screens/LimitScreen';
import KYCBvnScreen from '../screens/KYCBvnScreen';
import KYCCaptureScreen from '../screens/KYCCaptureScreen';
import { colors } from '../theme';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Transfer: { kycSuccess?: boolean } | undefined;
  Settings: { limitIncreased?: boolean } | undefined;
  Limit: undefined;
  KYCBvn: { reason: 'transfer' | 'limit' | 'biometrics' };
  KYCCapture: {
    mode: 'onboarding' | 'verification';
    reason: 'transfer' | 'limit' | 'biometrics';
    bvn?: string;
    name?: string;
    pendingLimitNg?: number;
    pendingTransfer?: { amount_ngn: number; beneficiary_account_number: string };
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '700', fontSize: 17, color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerBackTitleVisible: false,
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Transfer"
          component={TransferScreen}
          options={{ title: 'Other Banks Transfers' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Profile' }}
        />
        <Stack.Screen
          name="Limit"
          component={LimitScreen}
          options={{ title: 'Adjust limits' }}
        />
        <Stack.Screen
          name="KYCBvn"
          component={KYCBvnScreen}
          options={{ title: 'Enter BVN' }}
        />
        <Stack.Screen
          name="KYCCapture"
          component={KYCCaptureScreen}
          options={{ title: 'Capture photo', headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
