import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { getPendingAuthRequests } from '../api/pushAuth';
import type { AuthRequestItem, AuthRequestType } from '../api/pushAuth';
import { colors, radius, spacing, typography } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AuthorizationList'>;

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

export default function AuthorizationListScreen() {
  const { customerId, isAuthenticated } = useAuth();
  const navigation = useNavigation<Nav>();
  const [requests, setRequests] = useState<AuthRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!customerId || !isAuthenticated) {
      setRequests([]);
      setLoading(false);
      return;
    }
    try {
      const list = await getPendingAuthRequests(customerId);
      setRequests(list);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const onPressItem = (requestId: string) => {
    navigation.navigate('Authorization', { requestId });
  };

  if (!isAuthenticated || !customerId) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIcon}>🔐</Text>
          </View>
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptyText}>Sign in to view and approve authorization requests.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Authorizations</Text>
        <Text style={styles.screenSubtitle}>
          Review and approve sign-ins, transfers, and consent prompts from other channels.
        </Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderLabel}>Loading requests…</Text>
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelIcon}>📭</Text>
            <Text style={styles.emptyPanelTitle}>No pending requests</Text>
            <Text style={styles.emptyPanelText}>
              When another channel needs your approval, it will appear here. You can also open requests from push
              notifications.
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>Pending</Text>
              </View>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{requests.length}</Text>
              </View>
            </View>
            <Text style={styles.sectionHint}>Tap a request to review details and approve or reject.</Text>

            <View style={styles.requestList}>
              {requests.map((item) => {
                const meta = requestTypeMeta(item.request_type);
                return (
                  <Pressable
                    key={item.request_id}
                    style={({ pressed }) => [styles.requestCard, pressed && styles.cardPressed]}
                    onPress={() => onPressItem(item.request_id)}
                  >
                    <View style={[styles.requestIconWrap, { borderColor: meta.accent }]}>
                      <Text style={[styles.requestIconLetter, { color: meta.accent }]}>{meta.short}</Text>
                    </View>
                    <View style={styles.requestBody}>
                      <View style={styles.requestTopRow}>
                        <View style={[styles.badge, { backgroundColor: `${meta.accent}22` }]}>
                          <Text style={[styles.badgeText, { color: meta.accent }]}>
                            {typeLabel(item.request_type)}
                          </Text>
                        </View>
                        <Text style={styles.timeAgo}>{formatTimeAgo(item.created_at)}</Text>
                      </View>
                      <Text style={styles.summary} numberOfLines={2}>
                        {requestSummary(item)}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  loaderLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    ...typography.titleSm,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  emptyPanel: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    maxWidth: 360,
  },
  emptyPanelIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
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
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionWrap: {
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
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: 11,
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
});
