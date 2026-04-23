import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';
import { useAppColors, useIsDarkMode } from '@/hooks/use-app-colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function TokenScreen() {
  const c = useAppColors();
  const isDark = useIsDarkMode();
  const router = useRouter();
  const { totpAccount, isTokenSetup, removeToken } = useAuth();

  const handleRemove = () => {
    Alert.alert(
      'Remove Token',
      'This will delete the token from this device. You will need to set up again from your banking channel.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: removeToken },
      ],
    );
  };

  if (!isTokenSetup) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <Text style={[styles.title, { color: c.text }]}>Token</Text>
        <View style={[styles.emptyCard, { borderColor: c.border }]}>
          <Ionicons name="key-outline" size={48} color={c.textMuted} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>No token configured</Text>
          <Text style={[styles.emptyText, { color: c.textMuted }]}>
            Scan a QR code from your banking channel to set up your authenticator token.
          </Text>
          <TouchableOpacity
            style={[styles.setupBtn, { backgroundColor: c.orange }]}
            onPress={() => router.push('/scan')}
          >
            <Ionicons name="qr-code-outline" size={18} color="#fff" />
            <Text style={styles.setupBtnText}>Scan QR Code</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <Text style={[styles.title, { color: c.text }]}>Token Details</Text>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.row}>
          <View style={[styles.badge, { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' }]}>
            <Text style={[styles.badgeText, { color: c.orange }]}>{totpAccount!.issuer[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.issuer, { color: c.text }]}>{totpAccount!.issuer}</Text>
            <Text style={[styles.label, { color: c.textMuted }]}>{totpAccount!.label}</Text>
          </View>
        </View>

        <View style={[styles.detailRow, { borderTopColor: c.border }]}>
          <Text style={[styles.detailLabel, { color: c.textMuted }]}>Username</Text>
          <Text style={[styles.detailValue, { color: c.text }]}>{totpAccount!.username}</Text>
        </View>

        <View style={[styles.detailRow, { borderTopColor: c.border }]}>
          <Text style={[styles.detailLabel, { color: c.textMuted }]}>Algorithm</Text>
          <Text style={[styles.detailValue, { color: c.text }]}>SHA-1 (HMAC)</Text>
        </View>

        <View style={[styles.detailRow, { borderTopColor: c.border }]}>
          <Text style={[styles.detailLabel, { color: c.textMuted }]}>Period</Text>
          <Text style={[styles.detailValue, { color: c.text }]}>30 seconds</Text>
        </View>

        <View style={[styles.detailRow, { borderTopColor: c.border }]}>
          <Text style={[styles.detailLabel, { color: c.textMuted }]}>Digits</Text>
          <Text style={[styles.detailValue, { color: c.text }]}>6</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.removeBtn} onPress={handleRemove}>
        <Ionicons name="trash-outline" size={18} color="#DC2626" />
        <Text style={styles.removeBtnText}>Remove Token</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 20, fontWeight: '700' },
  issuer: { fontSize: 18, fontWeight: '600' },
  label: { fontSize: 14, marginTop: 2 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600' },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
  },
  removeBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 8,
  },
  setupBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
