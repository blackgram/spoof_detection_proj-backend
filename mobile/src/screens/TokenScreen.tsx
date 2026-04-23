import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Dimensions,
  ScrollView,
  Clipboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import Svg, { Circle } from 'react-native-svg';
import { generateTOTP, PERIOD } from '../lib/totp';
import { TOTP_ACCOUNTS_KEY } from '../lib/totpSecureStore';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TotpAccount {
  id: string;
  label: string;
  issuer: string;
  secret: string;
}

async function loadAccounts(): Promise<TotpAccount[]> {
  try {
    const raw = await SecureStore.getItemAsync(TOTP_ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TotpAccount[];
  } catch {
    return [];
  }
}

async function saveAccounts(accounts: TotpAccount[]): Promise<void> {
  await SecureStore.setItemAsync(TOTP_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function CountdownRing({
  remaining,
  period,
  size = 44,
}: {
  remaining: number;
  period: number;
  size?: number;
}) {
  const strokeWidth = 3;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = remaining / period;
  const strokeDashoffset = circumference * (1 - progress);
  const isLow = remaining <= 5;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={isLow ? colors.error : colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={[styles.countdownText, isLow && styles.countdownLow]}>
        {remaining}
      </Text>
    </View>
  );
}

export default function TokenScreen() {
  const [accounts, setAccounts] = useState<TotpAccount[]>([]);
  const [codes, setCodes] = useState<Record<string, { code: string; remaining: number }>>({});
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const isFocused = useIsFocused();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didAutoVerifyRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      loadAccounts().then(setAccounts);
      return () => {
        setBiometricUnlocked(false);
        setBiometricError(null);
        didAutoVerifyRef.current = false;
      };
    }, [])
  );

  const handleBiometricVerify = useCallback(async () => {
    setBiometricError(null);
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      setBiometricError('This device does not support biometrics.');
      return;
    }
    const { success, error } = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify your identity to view token codes',
      fallbackLabel: 'Use PIN',
    });
    if (success) {
      setBiometricUnlocked(true);
    } else {
      if (error === 'user_cancel') {
        setBiometricError(null);
      } else {
        setBiometricError('Verification failed. Please try again.');
      }
    }
  }, []);

  // Auto-prompt biometrics only when this tab is focused (not when user switched away)
  useEffect(() => {
    if (
      isFocused &&
      accounts.length > 0 &&
      !biometricUnlocked &&
      !didAutoVerifyRef.current
    ) {
      didAutoVerifyRef.current = true;
      handleBiometricVerify();
    }
  }, [isFocused, accounts.length, biometricUnlocked, handleBiometricVerify]);

  const refreshCodes = useCallback(() => {
    const newCodes: Record<string, { code: string; remaining: number }> = {};
    for (const acc of accounts) {
      try {
        const { code, remainingSeconds } = generateTOTP(acc.secret);
        newCodes[acc.id] = { code, remaining: remainingSeconds };
      } catch {
        newCodes[acc.id] = { code: '------', remaining: 0 };
      }
    }
    setCodes(newCodes);
  }, [accounts]);

  useEffect(() => {
    refreshCodes();
    timerRef.current = setInterval(refreshCodes, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshCodes]);

  const handleRemoveAccount = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    Alert.alert(
      'Remove token?',
      `Remove "${acc?.label}" from this device? You will no longer be able to generate codes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = accounts.filter((a) => a.id !== id);
            setAccounts(updated);
            await saveAccounts(updated);
          },
        },
      ],
    );
  };

  const handleCopyCode = (code: string) => {
    Clipboard.setString(code);
    Alert.alert('Copied', 'Code copied to clipboard.');
  };

  // ─── Empty state ───
  if (accounts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Software Token</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>🔐</Text>
          </View>
          <Text style={styles.emptyTitle}>No tokens yet</Text>
          <Text style={styles.emptySubtitle}>
            {isAuthenticated
              ? 'Set up a token from your Profile screen when you are signed in.'
              : 'Sign in to your account and use the Profile screen to set up a software token.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Biometric gate: require verification before showing codes ───
  if (!biometricUnlocked) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Software Token</Text>
        </View>
        <View style={styles.lockState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>🔒</Text>
          </View>
          <Text style={styles.emptyTitle}>Verify to view codes</Text>
          <Text style={styles.emptySubtitle}>
            Use Face ID, fingerprint, or device PIN to view your token codes.
          </Text>
          {biometricError ? (
            <Text style={styles.biometricError}>{biometricError}</Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}
            onPress={handleBiometricVerify}
          >
            <Text style={styles.addButtonText}>VERIFY</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Software Token</Text>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {accounts.map((acc) => {
          const entry = codes[acc.id];
          const code = entry?.code ?? '------';
          const remaining = entry?.remaining ?? PERIOD;
          const formatted = `${code.slice(0, 3)} ${code.slice(3)}`;

          return (
            <Pressable
              key={acc.id}
              style={styles.tokenCard}
              onPress={() => handleCopyCode(code)}
              onLongPress={() => handleRemoveAccount(acc.id)}
            >
              <View style={styles.tokenLeft}>
                <View style={styles.tokenAvatar}>
                  <Text style={styles.tokenAvatarText}>
                    {acc.issuer.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.tokenInfo}>
                  <Text style={styles.tokenIssuer}>{acc.issuer}</Text>
                  <Text style={styles.tokenLabel}>{acc.label}</Text>
                </View>
              </View>

              <View style={styles.tokenRight}>
                <Text style={styles.tokenCode}>{formatted}</Text>
                <CountdownRing remaining={remaining} period={PERIOD} />
              </View>
            </Pressable>
          );
        })}

        <Text style={styles.hint}>Tap to copy  ·  Long press to remove</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  headerAdd: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
  },
  headerAddText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyIconText: { fontSize: 36 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  lockState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  biometricError: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  // Token list
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  tokenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tokenLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  tokenAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  tokenAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  tokenInfo: { flex: 1 },
  tokenIssuer: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  tokenLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  tokenRight: { alignItems: 'flex-end', gap: 6 },
  tokenCode: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },

  countdownText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  countdownLow: {
    color: colors.error,
  },

  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Buttons
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonPressed: { opacity: 0.85 },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalKav: {
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  modalClose: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  secretInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
});
