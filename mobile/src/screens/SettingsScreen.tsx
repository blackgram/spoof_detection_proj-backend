import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { TOTP_ACCOUNTS_KEY } from '../lib/totpSecureStore';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export default function SettingsScreen() {
  const { user, kycCompleted, logout, getProfile, isAuthenticated } = useAuth();
  const navigation = useNavigation<Nav>();
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);
  const [hasToken, setHasToken] = useState<boolean>(false);

  const refreshState = useCallback(async () => {
    // Biometrics state (only when logged in)
    if (user?.name?.trim()) {
      const profile = await getProfile(user.name);
      setBiometricsEnabled(!!profile?.hasBiometrics);
    } else {
      setBiometricsEnabled(false);
    }

    // Token state (local SecureStore)
    try {
      const raw = await SecureStore.getItemAsync(TOTP_ACCOUNTS_KEY);
      if (!raw) {
        setHasToken(false);
      } else {
        const parsed = JSON.parse(raw);
        setHasToken(Array.isArray(parsed) && parsed.length > 0);
      }
    } catch {
      setHasToken(false);
    }
  }, [user?.name, getProfile]);

  useFocusEffect(
    useCallback(() => {
      refreshState();
    }, [refreshState])
  );

  const handleAdjustLimits = () => {
    navigation.navigate('TransactionPin', { next: { type: 'adjust_limit' } });
  };

  const handleTokenPress = () => {
    if (!hasToken) {
      // Go through PIN + KYC + backend provisioning flow
      navigation.navigate('TransactionPin', { next: { type: 'setup_token' } });
      return;
    }
    // When token exists, switch to the Token tab to view codes
    navigation.getParent()?.navigate('TokenTab');
  };

  const handleTokenLongPress = () => {
    if (!hasToken) return;
    Alert.alert(
      'Disable software token',
      'This will remove the software token from this device. You will no longer be able to generate codes here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync(TOTP_ACCOUNTS_KEY);
            } finally {
              setHasToken(false);
            }
          },
        },
      ]
    );
  };

  const handleBiometricsToggle = (value: boolean) => {
    if (!user?.name?.trim()) return;
    if (value) {
      navigation.navigate('TransactionPin', { next: { type: 'enable_biometrics' } });
      return;
    }
    Alert.alert(
      'Disable biometrics',
      'You will sign in with your password next time. You can turn biometrics back on here anytime.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => refreshState() },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: () => {
            navigation.navigate('TransactionPin', { next: { type: 'disable_biometrics' } });
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // ─── Logged-out settings (language, appearance, etc. – non-functional) ───
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AC</Text>
            </View>
            <Text style={styles.userName}>SETTINGS</Text>
            <Text style={styles.kycBadge}>Not signed in</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.menuRow}>
              <View style={styles.menuRowLabel}>
                <Text style={styles.menuRowText}>Language</Text>
                <Text style={styles.menuRowSubtext}>English (Coming soon)</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.menuRow}>
              <View style={styles.menuRowLabel}>
                <Text style={styles.menuRowText}>Product suggestions</Text>
                <Text style={styles.menuRowSubtext}>Personalised tips (Coming soon)</Text>
              </View>
              <Switch
                value={false}
                onValueChange={() => {}}
                trackColor={{ false: colors.border, true: colors.primaryMuted }}
                thumbColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Pressable
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              onPress={() => {}}
            >
              <View style={styles.menuRowLabel}>
                <Text style={styles.menuRowText}>Appearance</Text>
                <Text style={styles.menuRowSubtext}>Light / Dark / System (Coming soon)</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Logged-in profile (current implementation) ───
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.slice(0, 2).toUpperCase() ?? 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name?.toUpperCase() ?? 'USER'}</Text>
          <Text style={styles.kycBadge}>{kycCompleted ? 'KYC verified' : 'KYC not completed'}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.menuRow}>
            <View style={styles.menuRowLabel}>
              <Text style={styles.menuRowText}>Biometric sign-in</Text>
              <Text style={styles.menuRowSubtext}>
                {biometricsEnabled
                  ? 'Sign in with Face ID or fingerprint'
                  : 'Turn on to use passkey sign-in'}
              </Text>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleBiometricsToggle}
              trackColor={{ false: colors.border, true: colors.primaryMuted }}
              thumbColor={biometricsEnabled ? colors.primary : colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            onPress={handleAdjustLimits}
          >
            <Text style={styles.menuRowText}>Adjust limits</Text>
            <Text style={styles.menuRowSubtext}>
              Change your daily transfer limit (KYC required)
            </Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            onPress={handleTokenPress}
            onLongPress={handleTokenLongPress}
          >
            <View style={styles.menuRowLabel}>
              <Text style={styles.menuRowText}>Software token</Text>
              <Text style={styles.menuRowSubtext}>
                {hasToken
                  ? 'Token is active on this device. Tap to view codes, long press to disable.'
                  : 'Set up a software token for secure authentication.'}
              </Text>
            </View>
            <Text style={styles.chevron}>{hasToken ? '✓' : '›'}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            onPress={handleLogout}
          >
            <Text style={[styles.menuRowText, { color: colors.error }]}>Sign out</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryMuted,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
  kycBadge: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
  },
  section: {
    marginBottom: spacing.lg,
  },
  menuRow: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  menuRowLabel: {
    flex: 1,
  },
  menuRowPressed: {
    opacity: 0.92,
    borderColor: colors.primaryMuted,
  },
  menuRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  menuRowSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginRight: spacing.sm,
    maxWidth: '60%',
  },
  chevron: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: '600',
  },
});
