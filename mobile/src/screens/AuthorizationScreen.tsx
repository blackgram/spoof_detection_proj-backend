import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../context/AuthContext';
import {
  getAuthRequestDetails,
  respondToAuthRequest,
  type AuthRequestItem,
  type AuthRequestType,
} from '../api/pushAuth';
import { colors, radius, spacing, typography } from '../theme';
import FingerprintIcon from '../components/Icons/FingerprintIcon';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Authorization'>;
type Route = RouteProp<RootStackParamList, 'Authorization'>;

function typeLabel(type: AuthRequestType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
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

function requestSummary(item: AuthRequestItem): string {
  const ch = item.channel ? ` from ${item.channel}` : '';
  if (item.request_type === 'transfer') {
    const amt = (item.details as { amount_ngn?: number })?.amount_ngn;
    const beneficiary = (item.details as { beneficiary_name?: string })?.beneficiary_name;
    if (amt != null && beneficiary) return `₦${amt.toLocaleString()} to ${beneficiary}${ch}`;
    if (amt != null) return `₦${amt.toLocaleString()}${ch}`;
  }
  if (item.request_type === 'login') {
    const loc =
      (item.details as { city?: string })?.city ?? (item.details as { location?: string })?.location;
    return loc ? `Login from ${loc}${ch}` : `Login request${ch}`;
  }
  if (item.request_type === 'consent') {
    const svc = (item.details as { service_name?: string })?.service_name;
    return svc ? `${svc}${ch}` : `Consent request${ch}`;
  }
  return `${typeLabel(item.request_type)} request${ch}`;
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

function remainingSeconds(expiresAt: string): number {
  try {
    const end = new Date(expiresAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((end - now) / 1000));
  } catch {
    return 0;
  }
}

function shortId(id: string): string {
  if (id.length <= 10) return id;
  return `…${id.slice(-8)}`;
}

export default function AuthorizationScreen() {
  const { customerId } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const requestId = route.params?.requestId;

  const [item, setItem] = useState<AuthRequestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);
  const didAutoVerifyRef = useRef(false);

  useEffect(() => {
    didAutoVerifyRef.current = false;
    setBiometricUnlocked(false);
    setBiometricError(null);
  }, [requestId]);

  const loadDetails = useCallback(async () => {
    if (!requestId) {
      setError('Missing request');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getAuthRequestDetails(requestId);
      setItem(data);
      if (data.status !== 'pending') {
        setError('This request has already been responded to or has expired.');
      }
      setSecondsLeft(remainingSeconds(data.expires_at));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load request');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useFocusEffect(
    useCallback(() => {
      loadDetails();
      return () => {
        setBiometricUnlocked(false);
        setBiometricError(null);
        didAutoVerifyRef.current = false;
      };
    }, [loadDetails])
  );

  useEffect(() => {
    if (!item || item.status !== 'pending') return;
    const tick = () => setSecondsLeft((prev) => Math.max(0, prev - 1));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [item?.status]);

  const pendingLive = useMemo(
    () => Boolean(item?.status === 'pending' && secondsLeft > 0),
    [item?.status, secondsLeft]
  );

  const expired = !pendingLive;
  const showDetails = Boolean(item && (!pendingLive || biometricUnlocked));

  const handleBiometricVerify = useCallback(async () => {
    setBiometricError(null);
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      setBiometricError('This device does not support biometrics.');
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify your identity to approve or reject',
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
    if (item && pendingLive && !biometricUnlocked && !didAutoVerifyRef.current) {
      didAutoVerifyRef.current = true;
      handleBiometricVerify();
    }
  }, [item?.request_id, pendingLive, biometricUnlocked, handleBiometricVerify]);

  const submit = useCallback(
    async (action: 'approve' | 'reject') => {
      if (!requestId || !customerId || !item || item.status !== 'pending') return;
      if (secondsLeft <= 0) {
        Alert.alert('Expired', 'This request has expired.');
        return;
      }
      setSubmitting(action);
      try {
        await respondToAuthRequest(requestId, customerId, action);
        Alert.alert(
          action === 'approve' ? 'Approved' : 'Rejected',
          `Request has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit response');
      } finally {
        setSubmitting(null);
      }
    },
    [requestId, customerId, item, secondsLeft, navigation]
  );

  const canAct = pendingLive && biometricUnlocked && !submitting;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderLabel}>Loading request…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !item) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <View style={styles.errorPanel}>
            <View style={styles.errorPanelIconWrap}>
              <Text style={styles.errorPanelIcon}>!</Text>
            </View>
            <Text style={styles.errorTitle}>Can’t open this request</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const meta = item ? requestTypeMeta(item.request_type) : null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {item && meta ? (
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={[styles.typeIconWrap, { borderColor: meta.accent }]}>
                <Text style={[styles.typeIconLetter, { color: meta.accent }]}>{meta.short}</Text>
              </View>
              <View style={styles.heroBody}>
                <Text style={styles.heroSummary} numberOfLines={3}>
                  {requestSummary(item)}
                </Text>
                <View style={styles.heroMetaRow}>
                  <View style={[styles.typeBadge, { backgroundColor: `${meta.accent}22` }]}>
                    <Text style={[styles.typeBadgeText, { color: meta.accent }]}>
                      {typeLabel(item.request_type)}
                    </Text>
                  </View>
                  {item.channel ? (
                    <View style={styles.channelChip}>
                      <Text style={styles.channelChipText}>{item.channel}</Text>
                    </View>
                  ) : null}
                  {item.created_at ? (
                    <Text style={styles.timeAgo}>{formatTimeAgo(item.created_at)}</Text>
                  ) : null}
                </View>
                <Text style={styles.requestIdText}>Ref {shortId(item.request_id)}</Text>
              </View>
            </View>

            {pendingLive ? (
              <View
                style={[
                  styles.timerPill,
                  secondsLeft <= 60 && styles.timerPillUrgent,
                ]}
              >
                <Text style={styles.timerIcon}>⏱</Text>
                <Text
                  style={[
                    styles.timerPillText,
                    secondsLeft <= 60 && styles.timerPillTextUrgent,
                  ]}
                >
                  Expires in {Math.floor(secondsLeft / 60)}:
                  {(secondsLeft % 60).toString().padStart(2, '0')}
                </Text>
              </View>
            ) : (
              <View style={styles.statusBanner}>
                <Text style={styles.statusBannerText}>
                  {item.status !== 'pending'
                    ? 'This request is no longer active.'
                    : 'This request has expired.'}
                </Text>
              </View>
            )}

            {error && item.status !== 'pending' ? (
              <Text style={styles.inlineNotice}>{error}</Text>
            ) : null}
          </View>
        ) : null}

        {pendingLive && !biometricUnlocked && (
          <View style={styles.biometricCard}>
            <View style={styles.biometricIconCircle}>
              <FingerprintIcon size={36} color={colors.primary} />
            </View>
            <Text style={styles.biometricTitle}>Verify to continue</Text>
            <Text style={styles.biometricBody}>
              Use Face ID, fingerprint, or your device PIN to review details and approve or reject.
            </Text>
            {biometricError ? <Text style={styles.biometricError}>{biometricError}</Text> : null}
            <Pressable
              style={({ pressed }) => [styles.verifyBtn, pressed && styles.buttonPressed]}
              onPress={handleBiometricVerify}
            >
              <Text style={styles.verifyBtnText}>Verify identity</Text>
            </Pressable>
          </View>
        )}

        {showDetails && item ? (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionAccent, { backgroundColor: meta?.accent ?? colors.primary }]} />
                  <Text style={styles.sectionTitle}>Request details</Text>
                </View>
              </View>

              {item.request_type === 'login' && (
                <>
                  <DetailRow
                    label="Location"
                    value={
                      (item.details as { city?: string }).city ??
                      (item.details as { location?: string }).location ??
                      '—'
                    }
                  />
                  <DetailRow label="IP address" value={(item.details as { ip?: string }).ip ?? '—'} />
                  <DetailRow
                    label="Device"
                    value={
                      (item.details as { device?: string }).device ??
                      (item.details as { user_agent?: string }).user_agent ??
                      '—'
                    }
                  />
                </>
              )}
              {item.request_type === 'transfer' && (
                <>
                  <DetailRow
                    label="Amount"
                    value={
                      (item.details as { amount_ngn?: number }).amount_ngn != null
                        ? `₦${Number((item.details as { amount_ngn: number }).amount_ngn).toLocaleString()}`
                        : '—'
                    }
                    emphasize
                  />
                  <DetailRow
                    label="Beneficiary"
                    value={(item.details as { beneficiary_name?: string }).beneficiary_name ?? '—'}
                  />
                  <DetailRow
                    label="Account number"
                    value={
                      (item.details as { beneficiary_account_number?: string }).beneficiary_account_number ?? '—'
                    }
                  />
                  <DetailRow
                    label="Location"
                    value={
                      (item.details as { location?: string }).location ??
                      (item.details as { city?: string }).city ??
                      '—'
                    }
                  />
                </>
              )}
              {item.request_type === 'consent' && (
                <>
                  <DetailRow
                    label="Service"
                    value={(item.details as { service_name?: string }).service_name ?? '—'}
                  />
                  <DetailRow
                    label="Description"
                    value={(item.details as { description?: string }).description ?? '—'}
                  />
                  {(item.details as { permissions?: string[] })?.permissions?.length ? (
                    <View style={styles.permissionsBlock}>
                      <Text style={styles.permissionsLabel}>Permissions</Text>
                      {(item.details as { permissions: string[] }).permissions.map((p, i) => (
                        <View key={i} style={styles.permissionRow}>
                          <Text style={styles.permissionBullet}>•</Text>
                          <Text style={styles.permissionText}>{p}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              )}
            </View>

            {pendingLive ? (
              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.approveBtn,
                    (!canAct || submitting === 'approve') && styles.actionDisabled,
                    pressed && canAct && styles.actionPressed,
                  ]}
                  disabled={!canAct || submitting !== null}
                  onPress={() => submit('approve')}
                >
                  {submitting === 'approve' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.actionBtnTextPrimary}>Approve</Text>
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.rejectBtnOutline,
                    (!canAct || submitting === 'reject') && styles.actionDisabled,
                    pressed && canAct && styles.actionPressed,
                  ]}
                  disabled={!canAct || submitting !== null}
                  onPress={() => submit('reject')}
                >
                  {submitting === 'reject' ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Text style={styles.actionBtnTextReject}>Reject</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.readOnlyHint}>
                <Text style={styles.readOnlyHintText}>
                  You can’t approve or reject this request anymore.
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, emphasize && styles.detailValueEmphasis]}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loaderLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorPanel: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    marginBottom: spacing.lg,
    maxWidth: 320,
  },
  errorPanelIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.errorMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  errorPanelIcon: {
    color: colors.error,
    fontSize: 18,
    fontWeight: '800',
  },
  errorTitle: {
    ...typography.titleSm,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  secondaryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    ...typography.subtitle,
    color: colors.primary,
  },
  pressed: { opacity: 0.85 },

  heroCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  typeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconLetter: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroBody: { flex: 1, minWidth: 0 },
  heroSummary: {
    ...typography.subtitle,
    color: colors.text,
    lineHeight: 24,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  channelChip: {
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  channelChipText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  timeAgo: {
    ...typography.small,
    color: colors.textMuted,
  },
  requestIdText: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontVariant: ['tabular-nums'],
  },

  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primaryGlow,
  },
  timerPillUrgent: {
    backgroundColor: colors.errorMuted,
    borderColor: colors.error,
  },
  timerIcon: { fontSize: 16 },
  timerPillText: {
    ...typography.subtitle,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  timerPillTextUrgent: {
    color: colors.error,
  },

  statusBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorMuted,
  },
  statusBannerText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    fontWeight: '600',
  },
  inlineNotice: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  biometricCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    marginBottom: spacing.lg,
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

  sectionCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    marginBottom: spacing.md,
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
  },
  sectionTitle: {
    ...typography.titleSm,
    color: colors.text,
  },
  detailRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  detailValueEmphasis: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  permissionsBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  permissionsLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: 4,
  },
  permissionBullet: {
    color: colors.textMuted,
    marginTop: 2,
  },
  permissionText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    lineHeight: 22,
  },

  actions: {
    gap: spacing.md,
  },
  actionBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  actionPressed: { opacity: 0.92 },
  approveBtn: {
    backgroundColor: colors.success,
  },
  rejectBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.error,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionBtnTextPrimary: {
    ...typography.subtitle,
    color: '#fff',
    fontWeight: '700',
  },
  actionBtnTextReject: {
    ...typography.subtitle,
    color: colors.error,
    fontWeight: '700',
  },

  readOnlyHint: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readOnlyHintText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
