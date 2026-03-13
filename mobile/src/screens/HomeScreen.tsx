import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { getAccounts } from '../api/transactions';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const { user, customerId, getProfile } = useAuth();
  const navigation = useNavigation<Nav>();
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showEnableBiometricsModal, setShowEnableBiometricsModal] = useState(false);
  const [enableBiometricsDismissedThisSession, setEnableBiometricsDismissedThisSession] = useState(false);
  const greeting = getGreeting();

  useEffect(() => {
    if (!user?.name || enableBiometricsDismissedThisSession) return;
    getProfile(user.name).then((profile) => {
      if (!profile?.hasBiometrics) {
        setShowEnableBiometricsModal(true);
      }
    });
  }, [user?.name, getProfile, enableBiometricsDismissedThisSession]);

  const handleEnableBiometrics = () => {
    setShowEnableBiometricsModal(false);
    navigation.navigate('KYCBvn', { reason: 'biometrics' });
  };

  const handleNotNow = () => {
    setShowEnableBiometricsModal(false);
    setEnableBiometricsDismissedThisSession(true);
  };

  const loadBalance = useCallback(async () => {
    if (!customerId) {
      setBalance(null);
      return;
    }
    setBalanceLoading(true);
    try {
      const accounts = await getAccounts(customerId);
      const first = accounts[0];
      setBalance(first ? first.balance_ngn : 0);
    } catch {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      loadBalance();
    }, [loadBalance])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <Modal
        visible={showEnableBiometricsModal}
        transparent
        animationType="fade"
        onRequestClose={handleNotNow}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enable biometrics?</Text>
            <Text style={styles.modalMessage}>
              Sign in faster next time with Face ID or fingerprint. You’ll need to complete identity verification (KYC) first.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.modalButton, pressed && styles.modalButtonPressed]}
              onPress={handleEnableBiometrics}
            >
              <Text style={styles.modalButtonText}>Enable</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.modalButtonSecondary, pressed && styles.modalButtonPressed]}
              onPress={handleNotNow}
            >
              <Text style={styles.modalButtonSecondaryText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.greeting}>
          {greeting}, {user?.name ?? 'User'}
        </Text>
        <Text style={styles.subtitle}>AccessMore (Proof of concept)</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.balanceLabel}>Consolidated NGN Balance</Text>
        {balanceLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
        ) : (
          <Text style={styles.balance}>
            ₦ {(balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </Text>
        )}
        <View style={styles.balanceAccent} />
        <Text style={styles.accountInfo}>
          {customerId ? 'Current Account • REGULAR' : 'Complete KYC to see balance'}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
          onPress={() => navigation.navigate('Transfer', undefined)}
        >
          <View style={styles.actionIcon}>
            <Text style={styles.actionEmoji}>💸</Text>
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Transfer</Text>
            <Text style={styles.actionSubtitle}>Other banks & more</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
          onPress={() => navigation.navigate('Settings', undefined)}
        >
          <View style={styles.actionIcon}>
            <Text style={styles.actionEmoji}>⚙️</Text>
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Settings</Text>
            <Text style={styles.actionSubtitle}>Limit & security</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balance: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  balanceAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
  },
  accountInfo: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  actionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionCardPressed: {
    opacity: 0.92,
    borderColor: colors.primaryMuted,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  actionEmoji: {
    fontSize: 26,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionChevron: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalButtonSecondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonPressed: {
    opacity: 0.9,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalButtonSecondaryText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
