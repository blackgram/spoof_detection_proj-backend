import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { BiometricGate } from '@/components/biometric-gate';
import { useAuth } from '@/context/AuthContext';
import { useAppColors, useIsDarkMode } from '@/hooks/use-app-colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import Svg, { Circle } from 'react-native-svg';
import { generateTOTP, PERIOD } from '@/lib/totp';

const SVG_SIZE = 96;
const SVG_RADIUS = 42;
const SVG_CIRCUMFERENCE = 2 * Math.PI * SVG_RADIUS;

export default function TokenScreen() {
  const c = useAppColors();
  const isDark = useIsDarkMode();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { totpAccounts, isTokenSetup, isBiometricLocked, getTokenById, removeToken } = useAuth();
  const token = id ? getTokenById(id) : totpAccounts[0] ?? null;

  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(PERIOD);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!token) return;
    const refresh = () => {
      const result = generateTOTP(token.secret);
      setCode(result.code);
      setSecondsLeft(result.remainingSeconds);
    };
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [token]);

  const isExpiring = secondsLeft <= 5;
  const progress = secondsLeft / PERIOD;
  const codeColor = isExpiring ? c.orange : c.primary;
  const digitBg = isExpiring ? (isDark ? '#2A1800' : '#FFF3E0') : c.accent;
  const dashOffset = SVG_CIRCUMFERENCE * (1 - progress);

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isTokenSetup && isBiometricLocked) {
    return <BiometricGate title="Access Token" />;
  }

  /* ── Empty state ─────────────────────────────────────── */
  if (!isTokenSetup || !token) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={[styles.navBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <Text style={[styles.navTitle, { color: c.text }]}>Token</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={[styles.shieldBadge, { backgroundColor: c.accent }]}>
            <Ionicons name="shield-outline" size={40} color={c.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.text }]}>No token configured</Text>
          <Text style={[styles.emptySubtitle, { color: c.textMuted }]}>
            Scan a QR code from your banking channel to set up your authenticator token.
          </Text>
        </View>
        <View style={[styles.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: c.primary }]}
            onPress={() => router.push('/add-token')}
            activeOpacity={0.88}
          >
            <Ionicons name="add-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Add token</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Delete confirm screen ───────────────────────────── */
  if (showDeleteConfirm) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={[styles.navBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: 'transparent' }]}
            onPress={() => setShowDeleteConfirm(false)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={c.textMuted} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: c.text }]}>Delete token</Text>
        </View>

        <View style={styles.deleteCenter}>
          <View style={[styles.deleteBadge, { backgroundColor: isDark ? '#2a0a12' : '#fff0f3' }]}>
            <Ionicons name="trash-outline" size={32} color={c.error} />
          </View>
          <Text style={[styles.deleteTitle, { color: c.text }]}>Delete this token?</Text>
          <Text style={[styles.deleteSubtitle, { color: c.textMuted }]}>
            This action cannot be undone
          </Text>
          <Text style={[styles.deleteTokenName, { color: c.text }]}>
            {token!.issuer} ({token!.label})
          </Text>
        </View>

        <View style={[styles.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: c.error }]}
            onPress={() => removeToken(token!.id)}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outlineBtn, { borderColor: c.border, backgroundColor: isDark ? c.surface : '#fff' }]}
            onPress={() => setShowDeleteConfirm(false)}
            activeOpacity={0.88}
          >
            <Text style={[styles.outlineBtnText, { color: c.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Main detail view ────────────────────────────────── */
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={[styles.navBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: c.text }]}>Token details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main token card */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {/* Issuer icon */}
          <View style={styles.issuerCircleWrap}>
            <View style={[styles.issuerCircle, { backgroundColor: c.primary }]}>
              <Text style={styles.issuerInitial}>
                {token!.issuer.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.issuerName, { color: c.text }]}>{token!.issuer}</Text>
            <Text style={[styles.issuerAccount, { color: c.textMuted }]}>{token!.label}</Text>
          </View>

          {/* Digit cells */}
          <View style={styles.digitsRow}>
            {code.split('').map((digit, i) => (
              <View key={i} style={[styles.digitCell, { backgroundColor: digitBg }]}>
                <Text style={[styles.digitText, { color: codeColor }]}>{digit}</Text>
              </View>
            ))}
          </View>

          {/* Circular countdown */}
          <View style={styles.timerWrap}>
            <Svg width={SVG_SIZE} height={SVG_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle
                cx={SVG_SIZE / 2}
                cy={SVG_SIZE / 2}
                r={SVG_RADIUS}
                stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
                strokeWidth={4}
                fill="none"
              />
              <Circle
                cx={SVG_SIZE / 2}
                cy={SVG_SIZE / 2}
                r={SVG_RADIUS}
                stroke={codeColor}
                strokeWidth={6}
                fill="none"
                strokeDasharray={SVG_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            </Svg>
            <View style={styles.timerOverlay}>
              <Text style={[styles.timerCount, { color: codeColor, fontFamily: 'Inter_700Bold' }]}>
                {secondsLeft}
              </Text>
            </View>
            <Text style={[styles.timerLabel, { color: isExpiring ? c.orange : c.textMuted }]}>
              SECONDS
            </Text>
          </View>

          {/* Copy button */}
          <TouchableOpacity
            style={[styles.copyFullBtn, { backgroundColor: c.primary }]}
            onPress={handleCopy}
            activeOpacity={0.88}
          >
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
            <Text style={styles.copyFullBtnText}>{copied ? 'Copied' : 'Copy code'}</Text>
          </TouchableOpacity>
        </View>

        {/* Info card */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, marginTop: 0 }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: c.textMuted }]}>ACCOUNT</Text>
            <Text style={[styles.infoValue, { color: c.text }]}>{token!.label}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: c.textMuted }]}>ISSUER</Text>
            <Text style={[styles.infoValue, { color: c.text }]}>{token!.issuer}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: c.textMuted }]}>ALGORITHM</Text>
            <Text style={[styles.infoValue, { color: c.text }]}>SHA-1 (HMAC)</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: c.textMuted }]}>PERIOD</Text>
            <Text style={[styles.infoValue, { color: c.text }]}>30 seconds</Text>
          </View>
        </View>

        {/* Delete button */}
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: isDark ? '#2a0a12' : '#fff0f3' }]}
          onPress={() => setShowDeleteConfirm(true)}
          activeOpacity={0.88}
        >
          <Ionicons name="trash-outline" size={16} color={c.error} />
          <Text style={[styles.deleteBtnText, { color: c.error }]}>Delete token</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  navTitle: {
    fontSize: 19,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: { padding: 12, gap: 8, paddingBottom: 40 },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 8,
  },

  /* Issuer */
  issuerCircleWrap: { alignItems: 'center', marginBottom: 20 },
  issuerCircle: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  issuerInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter_700Bold',
  },
  issuerName: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    marginBottom: 2,
  },
  issuerAccount: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  /* Digits */
  digitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 24,
  },
  digitCell: {
    width: 40,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    fontSize: 28,
    fontFamily: 'Inter_400Regular',
  },

  /* Circular timer */
  timerWrap: { alignItems: 'center', marginBottom: 24 },
  timerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCount: { fontSize: 32 },
  timerLabel: {
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 4,
    fontFamily: 'Inter_500Medium',
  },

  /* Copy button */
  copyFullBtn: {
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  copyFullBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },

  /* Info rows */
  infoRow: { paddingVertical: 10 },
  infoLabel: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  divider: { height: 1 },

  /* Delete */
  deleteBtn: {
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },

  /* Empty state */
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  shieldBadge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Delete confirm */
  deleteCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  deleteBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
  },
  deleteSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 6,
    textAlign: 'center',
  },
  deleteTokenName: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },

  /* Bottom action bar */
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    gap: 8,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  outlineBtn: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
});
