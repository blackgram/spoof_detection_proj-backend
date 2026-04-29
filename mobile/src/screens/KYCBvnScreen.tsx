import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { KycReason } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

const HARDCODED_BVN = '12345678901';

type Nav = NativeStackNavigationProp<RootStackParamList, 'KYCBvn'>;

export default function KYCBvnScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const params = (route.params ?? {}) as {
    reason: KycReason;
    customerId?: string;
    username?: string;
  };
  const { reason, customerId, username } = params;

  useEffect(() => {
    console.log('[KYCBvnScreen] route params', { reason, customerId, username });
    const timer = setTimeout(() => {
      if (reason === 'registration') {
        console.log('[KYCBvnScreen] routing to KYCLivenessMulti', { reason, customerId, username });
        navigation.replace('KYCLivenessMulti', {
          reason,
          ...(customerId ? { customerId } : {}),
          ...(username ? { username } : {}),
        });
        return;
      }

      console.log('[KYCBvnScreen] routing to KYCCapture', { reason, customerId, username });
      navigation.replace('KYCCapture', {
        mode: 'onboarding',
        reason,
        bvn: HARDCODED_BVN,
        name: user?.name ?? username ?? 'Customer',
        ...(customerId ? { customerId } : {}),
        ...(username ? { registrationUsername: username } : {}),
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [navigation, reason, user?.name, customerId, username]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
