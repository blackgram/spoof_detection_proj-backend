import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export default function SettingsScreen() {
  const { user, kycCompleted, logout, getProfile, clearBiometricsForUsername } = useAuth();
  const navigation = useNavigation<Nav>();
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);

  const refreshBiometricsState = useCallback(async () => {
    if (!user?.name?.trim()) return;
    const profile = await getProfile(user.name);
    setBiometricsEnabled(!!profile?.hasBiometrics);
  }, [user?.name, getProfile]);

  useFocusEffect(
    useCallback(() => {
      refreshBiometricsState();
    }, [refreshBiometricsState])
  );

  const handleAdjustLimits = () => {
    navigation.navigate('Limit', undefined);
  };

  const handleBiometricsToggle = async (value: boolean) => {
    if (!user?.name?.trim()) return;
    if (value) {
      navigation.navigate('KYCBvn', { reason: 'biometrics' });
      return;
    }
    Alert.alert(
      'Disable biometrics',
      'You will sign in with your password next time. You can turn biometrics back on here anytime.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => refreshBiometricsState() },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            await clearBiometricsForUsername(user.name!);
            setBiometricsEnabled(false);
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
