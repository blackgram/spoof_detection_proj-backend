import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import Svg, { Circle } from 'react-native-svg';
import { generateTOTP, PERIOD } from '../lib/totp';
import { useAuth } from '../context/AuthContext';
import { getPendingAuthRequests } from '../api/pushAuth';
import type { AuthRequestItem, AuthRequestType } from '../api/pushAuth';
import { colors, radius, spacing, typography } from '../theme';
import { TOTP_ACCOUNTS_KEY } from '../lib/totpSecureStore';
import FingerprintIcon from '../components/Icons/FingerprintIcon';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TokenAndAuthorizations'>;

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

function formatTimeAgo(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return '';
  }
}

function typeLabel(type: AuthRequestType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function requestSummary(item: AuthRequestItem): string {
  const ch = item.channel ? ` from ${item.channel}` : '';
  if (item.request_type === 'transfer') {
    const amt = (item.details as { amount_ngn?: number })?.amount_ngn;
    const beneficiary = (item.details as { beneficiary_name?: string })?.beneficiary_name;
    if (amt != null && beneficiary) return `₦${amt.toLocaleString()} to ${beneficiary}${ch}`;
    if (amt != null) return `₦${amt.toLocaleString()}${ch}`;
  }
  if (item.request_type === 'login') {
    const loc = (item.details as { city?: string })?.city ?? (item.details as { location?: string })?.location;
    return loc ? `Login from ${loc}${ch}` : `Login request${ch}`;
  }
  if (item.request_type === 'consent') {
    const svc = (item.details as { service_name?: string })?.service_name;
    return svc ? `${svc}${ch}` : `Consent request${ch}`;
  }
  return `${typeLabel(item.request_type)} request${ch}`;
}

function requestTypeMeta(type: AuthRequestType): { short: string; accent: string } {
  switch (type) {
    case 'transfer':
      return { short: '₦', accent: colors.primary };
    case 'login':
      return { short: 'L', accent: colors.success };
    case 'consent':
      return { short: 'C', accent: colors.warning };
    default:
      return { short: '?', accent: colors.textMuted };
  }
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
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={strokeWidth} fill="none" />
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
      <Text style={[styles.countdownText, isLow && styles.countdownLow]}>{remaining}</Text>
    </View>
  );
}

export default function TokenAndAuthorizationsScreen() {
  const { customerId, isAuthenticated } = useAuth();
  const navigation = useNavigation<Nav>();
  const isFocused = useIsFocused();

  const [accounts, setAccounts] = useState<TotpAccount[]>([]);
  const [codes, setCodes] = useState<Record<string, { code: string; remaining: number }>>({});
  const [requests, setRequests] = useState<AuthRequestItem[]>([]);
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didAutoVerifyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRequests = useCallback(async () => {
    if (!customerId || !isAuthenticated) {
      setRequests([]);
      return;
    }
    try {
      const list = await getPendingAuthRequests(customerId);
      setRequests(list);
    } catch {
      setRequests([]);
    } finally {
      setRequestsLoading(false);
      setRefreshing(false);
    }
  }, [customerId, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      setRequestsLoading(true);
      loadAccounts().then(setAccounts);
      loadRequests();
      return () => {
        setBiometricUnlocked(false);
        setBiometricError(null);
        didAutoVerifyRef.current = false;
      };
    }, [loadRequests])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAccounts().then(setAccounts);
    loadRequests();
  }, [loadRequests]);

  const handleBiometricVerify = useCallback(async () => {
    setBiometricError(null);
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      setBiometricError('This device does not support biometrics.');
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify your identity to view token codes',
      fallbackLabel: 'Use PIN',
    });
    if (result.success) {
      setBiometricUnlocked(true);
    } else {
      const err = 'error' in result ? (result as { error?: string }).error : undefined;
      if (err === 'user_cancel') {
        setBiometricError(null);
      } else {
        setBiometricError('Verification failed. Please try again.');
      }
    }
  }, []);

  useEffect(() => {
    if (isFocused && accounts.length > 0 && !biometricUnlocked && !didAutoVerifyRef.current) {
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
      ]
    );
  };

  const handleCopyCode = (code: string) => {
    Clipboard.setString(code);
    Alert.alert('Copied', 'Code copied to clipboard.');
  };

  if (!isAuthenticated || !customerId) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIconText}>🔒</Text>
          </View>
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptyText}>Sign in to view your software token and approve requests from other channels.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Screen header */}
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>Token & authorizations</Text>
          <Text style={styles.screenSubtitle}>
            Approve sign-in and transfer requests, and generate one-time codes for internet banking.
          </Text>
        </View>

        {/* Pending requests */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Pending requests</Text>
            </View>
            {requests.length > 0 ? (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{requests.length}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.sectionHint}>From internet banking, ATMs, or other channels</Text>

          {requestsLoading && !refreshing ? (
            <View style={styles.loaderBlock}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loaderLabel}>Checking for requests…</Text>
            </View>
          ) : requests.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyPanelIcon}>✓</Text>
              <Text style={styles.emptyPanelTitle}>{"You're all caught up"}</Text>
              <Text style={styles.emptyPanelText}>No pending approvals. Pull down to refresh.</Text>
            </View>
          ) : (
            <View style={styles.requestList}>
              {requests.map((item) => {
                const meta = requestTypeMeta(item.request_type);
                return (
                  <Pressable
                    key={item.request_id}
                    style={({ pressed }) => [styles.requestCard, pressed && styles.cardPressed]}
                    onPress={() => navigation.navigate('Authorization', { requestId: item.request_id })}
                  >
                    <View style={[styles.requestIconWrap, { borderColor: meta.accent }]}>
                      <Text style={[styles.requestIconLetter, { color: meta.accent }]}>{meta.short}</Text>
                    </View>
                    <View style={styles.requestBody}>
                      <View style={styles.requestTopRow}>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{typeLabel(item.request_type)}</Text>
                        </View>
                        <Text style={styles.timeAgo}>{formatTimeAgo(item.created_at)}</Text>
                      </View>
                      <Text style={styles.summary} numberOfLines={2}>
                        {requestSummary(item)}
                      </Text>
                    </View>
                    <Text style={styles.chevron} accessibilityLabel="Open">
                      ›
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Software token */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionAccent, styles.sectionAccentAlt]} />
              <Text style={styles.sectionTitle}>Software token</Text>
            </View>
          </View>
          <Text style={styles.sectionHint}>Time-based one-time passwords for secure transactions</Text>

          {accounts.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyPanelIcon}>⌛</Text>
              <Text style={styles.emptyPanelTitle}>No token on this device</Text>
              <Text style={styles.emptyPanelText}>
                {"Set up a software token from Profile when you're signed in. You'll use it to confirm transfers and settings."}
              </Text>
            </View>
          ) : !biometricUnlocked ? (
            <View style={styles.biometricCard}>
              <View style={styles.biometricIconCircle}>
                <FingerprintIcon size={36} color={colors.primary} />
              </View>
              <Text style={styles.biometricTitle}>Unlock to view codes</Text>
              <Text style={styles.biometricBody}>
                Use Face ID, fingerprint, or your device PIN. Your codes stay protected until you verify.
              </Text>
              {biometricError ? <Text style={styles.biometricError}>{biometricError}</Text> : null}
              <Pressable
                style={({ pressed }) => [styles.verifyBtn, pressed && styles.buttonPressed]}
                onPress={handleBiometricVerify}
              >
                <Text style={styles.verifyBtnText}>Verify identity</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {accounts.map((acc) => {
                const entry = codes[acc.id];
                const code = entry?.code ?? '------';
                const remaining = entry?.remaining ?? PERIOD;
                const formatted = `${code.slice(0, 3)} ${code.slice(3)}`;
                return (
                  <Pressable
                    key={acc.id}
                    style={({ pressed }) => [styles.tokenCard, pressed && styles.cardPressed]}
                    onPress={() => handleCopyCode(code)}
                    onLongPress={() => handleRemoveAccount(acc.id)}
                  >
                    <View style={styles.tokenCardTop}>
                      <View style={styles.tokenLeft}>
                        <View style={styles.tokenAvatar}>
                          <Text style={styles.tokenAvatarText}>{acc.issuer.slice(0, 1).toUpperCase()}</Text>
                        </View>
                        <View style={styles.tokenInfo}>
                          <Text style={styles.tokenIssuer}>{acc.issuer}</Text>
                          <Text style={styles.tokenLabel}>{acc.label}</Text>
                        </View>
                      </View>
                      <CountdownRing remaining={remaining} period={PERIOD} size={40} />
                    </View>
                    <View style={styles.codeRow}>
                      <Text style={styles.tokenCode}>{formatted}</Text>
                    </View>
                  </Pressable>
                );
              })}
              <View style={styles.hintRow}>
                <Text style={styles.hintDot}>•</Text>
                <Text style={styles.hint}>Tap to copy</Text>
                <Text style={styles.hintSep}>·</Text>
                <Text style={styles.hint}>Long press to remove</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },

  screenHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  screenTitle: {
    ...typography.title,
    fontSize: 26,
    letterSpacing: -0.5,
    color: colors.text,
  },
  screenSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    
    lineHeight: 22,
  },

  sectionWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    overflow: 'hidden',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  sectionAccentAlt: {
    backgroundColor: colors.success,
  },
  sectionTitle: {
    ...typography.titleSm,
    color: colors.text,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  countPill: {
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    minWidth: 28,
    alignItems: 'center',
  },
  countPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  loaderBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    justifyContent: 'center',
  },
  loaderLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  emptyPanel: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  emptyPanelIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
    opacity: 0.9,
  },
  emptyPanelTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyPanelText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },

  requestList: {
    gap: spacing.sm,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  requestIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestIconLetter: {
    fontSize: 14,
    fontWeight: '800',
  },
  requestBody: {
    flex: 1,
    minWidth: 0,
  },
  requestTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeText: {
    ...typography.small,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeAgo: {
    ...typography.small,
    color: colors.textMuted,
  },
  summary: {
    ...typography.body,
    color: colors.text,
    lineHeight: 21,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
    fontWeight: '300',
    marginLeft: 4,
  },

  biometricCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  biometricIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  biometricTitle: {
    ...typography.titleSm,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  biometricBody: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
    maxWidth: 300,
  },
  biometricError: {
    fontSize: 14,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  verifyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: spacing.sm,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonPressed: { opacity: 0.88 },

  tokenCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tokenCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
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
  tokenAvatarText: { fontSize: 20, fontWeight: '700', color: colors.primary },
  tokenInfo: { flex: 1 },
  tokenIssuer: { fontSize: 16, fontWeight: '700', color: colors.text },
  tokenLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  codeRow: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tokenCode: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
  },
  countdownText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  countdownLow: { color: colors.error },

  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
    paddingTop: spacing.xs,
  },
  hintDot: { color: colors.textMuted, fontSize: 12 },
  hintSep: { color: colors.textMuted, fontSize: 12, marginHorizontal: 4 },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconText: {
    fontSize: 28,
  },
  emptyTitle: {
    ...typography.titleSm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
