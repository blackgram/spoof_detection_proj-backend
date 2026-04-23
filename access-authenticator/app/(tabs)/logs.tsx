import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';
import { useAppColors, useIsDarkMode } from '@/hooks/use-app-colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getPendingAuthRequests,
  respondToAuthRequest,
  type AuthRequestItem,
  type AuthRequestType,
} from '@/api/pushAuth';

const TYPE_META: Record<AuthRequestType, { icon: string; accent: string; label: string }> = {
  login: { icon: 'desktop-outline', accent: '#16A34A', label: 'Login' },
  transfer: { icon: 'swap-horizontal-outline', accent: '#2563EB', label: 'Transfer' },
  consent: { icon: 'shield-checkmark-outline', accent: '#D97706', label: 'Consent' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function LogsScreen() {
  const { totpAccount, isTokenSetup } = useAuth();
  const c = useAppColors();
  const isDark = useIsDarkMode();

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

  if (!isTokenSetup) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <Text style={[styles.title, { color: c.text }]}>Authorizations</Text>
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={48} color={c.textMuted} />
          <Text style={[styles.emptyText, { color: c.textMuted }]}>
            Set up your token to receive push authorization requests.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <Text style={[styles.title, { color: c.text }]}>Authorizations</Text>
      {requests.length > 0 && (
        <View style={[styles.countPill, { backgroundColor: c.orange }]}>
          <Text style={styles.countText}>{requests.length}</Text>
        </View>
      )}

      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchRequests} tintColor={c.orange} />
        }
      >
        {requests.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color={c.textMuted} />
            <Text style={[styles.emptyText, { color: c.textMuted }]}>
              No pending authorization requests.{'\n'}Pull down to refresh.
            </Text>
          </View>
        )}

        {loading && requests.length === 0 && (
          <ActivityIndicator size="large" color={c.orange} style={{ marginTop: 40 }} />
        )}

        {requests.map((req) => {
          const meta = TYPE_META[req.request_type] ?? TYPE_META.login;
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
                    <Text style={[styles.cardTitle, { color: c.text }]}>{meta.label}</Text>
                    <Text style={[styles.timeAgo, { color: c.textMuted }]}>{timeAgo(req.created_at)}</Text>
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
                  <Text style={{ color: '#fff', fontSize: 14 }}>Deny</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, { backgroundColor: c.orange }]}
                  disabled={isResponding}
                  onPress={() => handleRespond(req.request_id, 'approve')}
                >
                  <Text style={{ color: '#fff', fontSize: 14 }}>
                    {isResponding ? 'Processing…' : 'Approve'}
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
