import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BiometricGate } from '@/components/biometric-gate';
import { useAuth } from '@/context/AuthContext';
import { useAppColors } from '@/hooks/use-app-colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getPendingAuthRequests,
  respondToAuthRequest,
  type AuthRequestItem,
  type AuthRequestType,
} from '@/api/pushAuth';
import { useTranslation, type TranslateFn } from '@/lib/i18n';

const TYPE_ICONS: Record<AuthRequestType, { icon: string; accent: string; labelKey: string }> = {
  login: { icon: 'desktop-outline', accent: '#16A34A', labelKey: 'logs.types.login' },
  transfer: { icon: 'swap-horizontal-outline', accent: '#2563EB', labelKey: 'logs.types.transfer' },
  consent: { icon: 'shield-checkmark-outline', accent: '#D97706', labelKey: 'logs.types.consent' },
};

function timeAgo(iso: string, t: TranslateFn): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('logs.timeAgo.justNow');
  if (mins < 60) return t('logs.timeAgo.minutes', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('logs.timeAgo.hours', { n: hrs });
  return t('logs.timeAgo.days', { n: Math.floor(hrs / 24) });
}

export default function LogsScreen() {
  const { totpAccount, isTokenSetup, isBiometricLocked } = useAuth();
  const c = useAppColors();
  const { t } = useTranslation();

  const [requests, setRequests] = useState<AuthRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!totpAccount) return;
    setLoading(true);
    try {
      const data = await getPendingAuthRequests(totpAccount.username);
      setRequests(data);
    } catch (e) {
      if (__DEV__) console.warn('[Logs] Failed to fetch requests:', e);
    } finally {
      setLoading(false);
    }
  }, [totpAccount]);

  const handleRespond = async (requestId: string, action: 'approve' | 'reject') => {
    if (!totpAccount) return;
    setResponding(requestId);
    try {
      await respondToAuthRequest(requestId, totpAccount.username, action);
      setRequests((prev) => prev.filter((r) => r.request_id !== requestId));
    } catch (e) {
      if (__DEV__) console.warn('[Logs] Respond failed:', e);
    } finally {
      setResponding(null);
    }
  };

  if (isTokenSetup && isBiometricLocked) {
    return <BiometricGate title={t('biometric.title')} />;
  }

  if (!isTokenSetup) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <Text style={[styles.title, { color: c.text }]}>{t('logs.title')}</Text>
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={48} color={c.textMuted} />
          <Text style={[styles.emptyText, { color: c.textMuted }]}>
            {t('logs.empty.notSetup')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <Text style={[styles.title, { color: c.text }]}>{t('logs.title')}</Text>
      {requests.length > 0 && (
        <View style={[styles.countPill, { backgroundColor: c.orange }]}>
          <Text style={styles.countText}>{requests.length}</Text>
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchRequests} tintColor={c.orange} />
        }
      >
        {requests.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color={c.textMuted} />
            <Text style={[styles.emptyText, { color: c.textMuted }]}>
              {t('logs.empty.noRequests')}{'\n'}{t('logs.empty.pullToRefresh')}
            </Text>
          </View>
        )}

        {loading && requests.length === 0 && (
          <ActivityIndicator size="large" color={c.orange} style={{ marginTop: 40 }} />
        )}

        {requests.map((req) => {
          const meta = TYPE_ICONS[req.request_type] ?? TYPE_ICONS.login;
          const isResponding = responding === req.request_id;
          return (
            <View
              key={req.request_id}
              style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <View style={styles.cardRow}>
                <View style={[styles.typeBadge, { backgroundColor: meta.accent + '18' }]}>
                  <Ionicons name={meta.icon as any} size={22} color={meta.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardTitle, { color: c.text }]}>{t(meta.labelKey)}</Text>
                    <Text style={[styles.timeAgo, { color: c.textMuted }]}>{timeAgo(req.created_at, t)}</Text>
                  </View>
                  <Text style={[styles.channel, { color: c.textMuted }]}>{req.channel}</Text>
                  {req.request_type === 'transfer' && req.details.amount_ngn != null && (
                    <Text style={[styles.amount, { color: c.text }]}>
                      ₦{Number(req.details.amount_ngn).toLocaleString()} → {String(req.details.beneficiary_name ?? '')}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.denyBtn}
                  disabled={isResponding}
                  onPress={() => handleRespond(req.request_id, 'reject')}
                >
                  <Text style={{ color: '#fff', fontSize: 14 }}>{t('logs.deny')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, { backgroundColor: c.orange }]}
                  disabled={isResponding}
                  onPress={() => handleRespond(req.request_id, 'approve')}
                >
                  <Text style={{ color: '#fff', fontSize: 14 }}>
                    {isResponding ? t('common.processing') : t('logs.approve')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  list: { flex: 1, marginTop: 12 },
  listContent: { paddingBottom: Platform.OS === 'android' ? 24 : 8 },
  countPill: {
    position: 'absolute',
    top: 28,
    right: 24,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  typeBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  timeAgo: { fontSize: 12 },
  channel: { fontSize: 13, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  denyBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  approveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 60,
  },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
