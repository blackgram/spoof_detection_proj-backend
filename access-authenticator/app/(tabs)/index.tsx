import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useAuth } from '@/context/AuthContext';
import { useAppColors, useIsDarkMode } from '@/hooks/use-app-colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { generateTOTP, formatCode, PERIOD } from '@/lib/totp';

const CIRCLE_SIZE = 44;
const STROKE_WIDTH = 3.5;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function HomeScreen() {
  const { user, totpAccount, isTokenSetup } = useAuth();
  const c = useAppColors();
  const isDark = useIsDarkMode();
  const router = useRouter();

  const [fabOpen, setFabOpen] = useState(false);
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(PERIOD);

  // Generate TOTP code every second
  useEffect(() => {
    if (!totpAccount) return;

    const refresh = () => {
      const result = generateTOTP(totpAccount.secret);
      setCode(result.code);
      setSecondsLeft(result.remainingSeconds);
    };
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [totpAccount]);

  const progress = secondsLeft / PERIOD;

  const copyCode = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
  };

  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: fabOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fabOpen]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: fabOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(menuAnim, {
        toValue: fabOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fabOpen]);

  const menuTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const menuOpacity = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });



  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <Text style={[styles.heading, { color: c.text }]}>Authenticator</Text>
      <Text style={[styles.subheading, { color: c.textMuted }]}>
        Signed in as {user?.email ?? 'user'}
      </Text>

      {isTokenSetup && totpAccount ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.issuerBadge, { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' }]}>
              <Text style={[styles.issuerInitial, { color: c.orange }]}>
                {totpAccount.issuer[0]}
              </Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.issuer, { color: c.text }]}>{totpAccount.issuer}</Text>
              <Text style={[styles.account, { color: c.textMuted }]}>{totpAccount.label}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.6} onPress={copyCode}>
              <Ionicons name="copy-outline" size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.codeRow}>
            <Text style={[styles.code, { color: c.orange }]}>{formatCode(code)}</Text>
            <View style={styles.circularTimer}>
              <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
                <Circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  stroke={c.border}
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                />
                <Circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  stroke={secondsLeft <= 5 ? '#DC2626' : c.orange}
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                  strokeLinecap="round"
                  rotation="-90"
                  origin={`${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2}`}
                />
              </Svg>
              <Text style={[styles.circularTimerText, { color: secondsLeft <= 5 ? '#DC2626' : c.textMuted }]}>
                {secondsLeft}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.emptyCard, { borderColor: c.border }]}>
          <Ionicons name="key-outline" size={48} color={c.textMuted} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>No token set up</Text>
          <Text style={[styles.emptyText, { color: c.textMuted }]}>
            Scan a QR code or enter a setup key from your banking channel to get started.
          </Text>
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: c.orange }]}
            onPress={() => router.push('/scan')}
          >
            <Ionicons name="qr-code-outline" size={18} color="#fff" />
            <Text style={styles.setupButtonText}>Scan QR Code</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pending Approvals preview */}
      <View style={styles.approvalsContainer}>
        <View style={styles.approvalsHeader}>
          <Text style={[styles.approvalsTitle, { color: c.text }]}>Pending Approvals</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/logs')}>
            <Text style={{ fontSize: 14, color: c.orange }}>View all</Text>
          </TouchableOpacity>
        </View>
        {isTokenSetup ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.approvalRow}>
              <Ionicons name="desktop-outline" size={24} color={c.orange} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.approvalTitle, { color: c.text }]}>Login attempt from new device</Text>
                <Text style={[styles.approvalSub, { color: c.textMuted }]}>macOS - Chrome</Text>
              </View>
            </View>
            <View style={styles.approvalActions}>
              <TouchableOpacity style={[styles.denyBtn]}>
                <Text style={{ color: 'white', fontSize: 14 }}>Deny</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.approveBtn, { backgroundColor: c.orange }]}>
                <Text style={{ color: 'white', fontSize: 14 }}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={[styles.noApprovals, { color: c.textMuted }]}>
            Set up your token to receive push authorizations.
          </Text>
        )}
      </View>

      <View style={styles.fabContainer}>
        <Pressable
          onPress={() => {
            setFabOpen(!fabOpen);
          }}
          style={({ pressed }) => [
            styles.floatingActionButton,
            { backgroundColor: fabOpen ? 'white' : c.orange },
            !isDark && {borderColor: c.orange, borderWidth: 3}
          ]}
        >
          <Animated.View
            style={{
              transform: [{ rotate: rotation }],
            }}
          >
            <Ionicons
              name="add"
              size={40}
              color={fabOpen ? c.orange : 'white'}
            />
          </Animated.View>
        </Pressable>

        <Animated.View
          pointerEvents={fabOpen ? 'auto' : 'none'}
          style={[
            styles.fabMenu,
            {
              opacity: menuOpacity,
              transform: [{ translateY: menuTranslateY }],
            },
          ]}
        >
          <Animated.View
            style={{
              transform: [
                {
                  translateY: menuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
              opacity: menuOpacity,
            }}
          >
            <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setFabOpen(false); router.push('/scan'); }}>
              <Text style={styles.fabMenuText}>Scan a QR Code</Text>
              <Ionicons name="camera-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={{
              transform: [
                {
                  translateY: menuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
              opacity: menuOpacity,
            }}
          >
            <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setFabOpen(false); router.push('/manual-setup'); }}>
              <Text style={styles.fabMenuText}>Enter a setup key</Text>
              <Ionicons name="key-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  heading: { fontSize: 26, fontWeight: '700', marginBottom: 2 },
  subheading: { fontSize: 14, fontWeight: '500', marginBottom: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  issuerBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  issuerInitial: { fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  issuer: { fontSize: 16, fontWeight: '600' },
  account: { fontSize: 13, fontWeight: '400', marginTop: 1 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  code: { fontSize: 34, fontWeight: '700', letterSpacing: 4 },
  circularTimer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularTimerText: {
    position: 'absolute',
    fontSize: 13,
    fontWeight: '700',
  },
  floatingActionButton: {
    padding: 16,
    borderRadius: 40
  },

  fabMenu: {
    position: 'absolute',
    bottom: 70,
    right: 0,
    alignItems: 'flex-end',
    gap: 10,
  },

  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#4a4a4a',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    minWidth: 100,

    // iOS shadow
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },

    // Android shadow
    elevation: 4,
  },

  fabMenuText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 50,
    right: 30,
    alignItems: 'flex-end',
  },
  approvalsContainer: {
    marginTop: 24,
  },
  approvalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  approvalsTitle: { fontSize: 16, fontWeight: '600' },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  approvalTitle: { fontSize: 15, fontWeight: '500' },
  approvalSub: { fontSize: 13, marginTop: 2 },
  approvalActions: {
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
  noApprovals: { fontSize: 14, lineHeight: 20 },
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
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 8,
  },
  setupButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
