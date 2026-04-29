import React, { useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DeviceChangeScreen from '../screens/DeviceChangeScreen';
import TransactionPinScreen from '../screens/TransactionPinScreen';
import HomeScreen from '../screens/HomeScreen';
import TransferScreen from '../screens/TransferScreen';
import ReviewScreen from '../screens/ReviewScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LimitScreen from '../screens/LimitScreen';
import KYCBvnScreen from '../screens/KYCBvnScreen';
import KYCCaptureScreen from '../screens/KYCCaptureScreen';
import KYCLivenessMultiScreen from '../screens/KYCLivenessMultiScreen';
import TokenScreen from '../screens/TokenScreen';
import SupportScreen from '../screens/SupportScreen';
import ScanScreen from '../screens/ScanScreen';
import TokenAndAuthorizationsScreen from '../screens/TokenAndAuthorizationsScreen';
import AuthorizationScreen from '../screens/AuthorizationScreen';
import {
  LoginIcon,
  TokenIcon,
  SupportIcon,
  SettingsIcon,
  HomeIcon,
  ScanIcon,
} from '../components/Icons/TabIcons';
import { colors } from '../theme';

export type KycReason = 'transfer' | 'limit' | 'biometrics' | 'registration' | 'device_change' | 'token_setup';

export type PinNextAction =
  | { type: 'device_change'; customerId: string; username: string }
  | { type: 'enable_biometrics' }
  | { type: 'disable_biometrics' }
  | { type: 'adjust_limit' }
  | { type: 'setup_token' };

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  DeviceChange: undefined;
  TransactionPin: { next: PinNextAction };
  Home: undefined;
  Transfer: { kycSuccess?: boolean } | undefined;
  Review: {
    senderAccountNumber: string;
    senderAccountType: string;
    amount: number;
    beneficiaryAccountNumber: string;
    beneficiaryName: string;
    bankName: string;
    narration: string;
    customerId: string;
  };
  Settings: { limitIncreased?: boolean } | undefined;
  Limit: undefined;
  KYCBvn: { reason: KycReason; customerId?: string; username?: string };
  KYCCapture: {
    mode: 'onboarding' | 'verification';
    reason: KycReason;
    bvn?: string;
    name?: string;
    pendingLimitNg?: number;
    pendingTransfer?: { amount_ngn: number; beneficiary_account_number: string };
    customerId?: string;
    registrationUsername?: string;
  };
  KYCLivenessMulti: {
    reason: KycReason;
    pendingLimitNg?: number;
    pendingTransfer?: { amount_ngn: number; beneficiary_account_number: string };
    customerId?: string;
    username?: string;
  };
  MainTabs: undefined;
  Token: undefined;
  Support: undefined;
  Scan: undefined;
  AuthorizationList: undefined;
  TokenAndAuthorizations: undefined;
  Authorization: { requestId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const TAB_BAR_STYLE = {
  backgroundColor: colors.background,
  borderTopColor: colors.border,
  borderTopWidth: 1,
  height: 85,
  paddingBottom: 28,
  paddingTop: 8,
};

// ─── Unauthenticated tab screens ───

function LoginStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="DeviceChange" component={DeviceChangeScreen} />
      <Stack.Screen
        name="TransactionPin"
        component={TransactionPinScreen}
        options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="KYCBvn" component={KYCBvnScreen} />
      <Stack.Screen name="KYCCapture" component={KYCCaptureScreen} />
      <Stack.Screen name="KYCLivenessMulti" component={KYCLivenessMultiScreen} />
    </Stack.Navigator>
  );
}

function UnauthenticatedTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="LoginTab"
        component={LoginStack}
        options={{
          tabBarLabel: 'Login',
          tabBarIcon: ({ color, size }) => <LoginIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="TokenTab"
        component={TokenScreen}
        options={{
          tabBarLabel: 'Token',
          tabBarIcon: ({ color, size }) => <TokenIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="SupportTab"
        component={SupportScreen}
        options={{
          tabBarLabel: 'Support',
          tabBarIcon: ({ color, size }) => <SupportIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <SettingsIcon size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Authenticated tab screens ───

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: '',
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
        name="Review"
        component={ReviewScreen}
        options={{ title: 'Review' }}
      />
      <Stack.Screen
        name="TransactionPin"
        component={TransactionPinScreen}
        options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', headerShown: false }}
      />
      <Stack.Screen
        name="KYCBvn"
        component={KYCBvnScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="KYCCapture"
        component={KYCCaptureScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="KYCLivenessMulti"
        component={KYCLivenessMultiScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function TokenStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen
        name="TokenAndAuthorizations"
        component={TokenAndAuthorizationsScreen}
        options={{ title: 'Token & requests', headerShown: false }}
      />
      <Stack.Screen
        name="Authorization"
        component={AuthorizationScreen}
        options={{ title: 'Review request' }}
      />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: '',
      }}
    >
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
        name="TransactionPin"
        component={TransactionPinScreen}
        options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', headerShown: false }}
      />
      <Stack.Screen
        name="KYCBvn"
        component={KYCBvnScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="KYCCapture"
        component={KYCCaptureScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="KYCLivenessMulti"
        component={KYCLivenessMultiScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function AuthenticatedTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <HomeIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="TokenTab"
        component={TokenStack}
        options={{
          tabBarLabel: 'Token',
          tabBarIcon: ({ color, size }) => <TokenIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScanScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => <ScanIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="SupportTab"
        component={SupportScreen}
        options={{
          tabBarLabel: 'Support',
          tabBarIcon: ({ color, size }) => <SupportIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStack}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <SettingsIcon size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Root ───

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { request_id?: string };
      const requestId = data?.request_id;
      if (requestId && isAuthenticated && navigationRef.isReady()) {
        (navigationRef as { navigate: (name: string, params: object) => void }).navigate('TokenTab', {
          screen: 'Authorization',
          params: { requestId },
        });
      }
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {isAuthenticated ? <AuthenticatedTabs /> : <UnauthenticatedTabs />}
    </NavigationContainer>
  );
}
