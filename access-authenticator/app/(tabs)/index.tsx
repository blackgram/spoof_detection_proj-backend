import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { COUNTRIES, LANGUAGES } from '@/constants/preferences';
import { BiometricGate } from '@/components/biometric-gate';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/context/PreferencesContext';
import { useAppColors, useIsDarkMode } from '@/hooks/use-app-colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { generateTOTP, formatCode, PERIOD } from '@/lib/totp';

export default function HomeScreen() {
  const { totpAccounts, isTokenSetup, isBiometricLocked } = useAuth();
  const { country, language, setCountry, setLanguage } = usePreferences();
  const c = useAppColors();
  const isDark = useIsDarkMode();
  const router = useRouter();

  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ticker, setTicker] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setTicker(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const copyCode = async (tokenId: string, code: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedId(tokenId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const selectedCountry = COUNTRIES.find((item) => item.code === country) ?? COUNTRIES[0];
  const selectedLanguage = LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0];
  const pickerOpen = showCountryPicker || showLanguagePicker;

  if (isTokenSetup && isBiometricLocked) {
    return <BiometricGate title="Access Token" />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      {/* Watermark */}
      <Image
        source={require('@/assets/images/access-logo.png')}
        style={styles.watermark}
        resizeMode="contain"
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Access Token</Text>
          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: c.background, borderColor: c.border }]}
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={c.textMuted} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerFilters}>
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: c.background, borderColor: c.border }]}
            onPress={() => {
              setShowLanguagePicker(false);
              setShowCountryPicker((prev) => !prev);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.filterFlag}>{selectedCountry.flag}</Text>
            <Text numberOfLines={1} style={[styles.filterText, { color: c.text }]}>
              {selectedCountry.name}
            </Text>
            <Ionicons name="chevron-down" size={14} color={c.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: c.background, borderColor: c.border }]}
            onPress={() => {
              setShowCountryPicker(false);
              setShowLanguagePicker((prev) => !prev);
            }}
            activeOpacity={0.8}
          >
            <Text numberOfLines={1} style={[styles.filterText, { color: c.text }]}>
              {selectedLanguage.name}
            </Text>
            <Ionicons name="chevron-down" size={14} color={c.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isTokenSetup && totpAccounts.length > 0 ? (
          totpAccounts.map((token) => {
            const result = generateTOTP(token.secret, ticker);
            const isExpiring = result.remainingSeconds <= 5;
            const progress = result.remainingSeconds / PERIOD;
            const codeColor = isExpiring ? c.orange : c.primary;
            const digitBg = isExpiring ? (isDark ? '#2A1800' : '#FFF3E0') : c.accent;
            const tokenCode = result.code;

            return (
              <TouchableOpacity
                key={token.id}
                activeOpacity={0.97}
                onPress={() => router.push({ pathname: '/token', params: { id: token.id } })}
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTopLeft}>
                    <Text style={[styles.issuerName, { color: c.text }]}>{token.issuer}</Text>
                  </View>
                  <Text style={[styles.secondsLabel, { color: codeColor }]}>{result.remainingSeconds}s</Text>
                </View>

                <Text style={[styles.accountLabel, { color: c.textMuted }]}>{token.label}</Text>

                <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progress * 100}%` as any,
                        backgroundColor: codeColor,
                      },
                    ]}
                  />
                </View>

                <View style={styles.digitsRow}>
                  <View style={styles.digits}>
                    {formatCode(tokenCode).replace(' ', '').split('').map((digit, i) => (
                      <View key={i} style={[styles.digitCell, { backgroundColor: digitBg }]}>
                        <Text style={[styles.digitText, { color: codeColor, fontFamily: 'Inter_700Bold' }]}>
                          {digit}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => copyCode(token.id, tokenCode)} style={styles.copyBtn} activeOpacity={0.6}>
                    <Ionicons
                      name={copiedId === token.id ? 'checkmark' : 'copy-outline'}
                      size={18}
                      color={copiedId === token.id ? '#22c55e' : c.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          /* Empty state */
          <View style={styles.emptyContainer}>
            <View style={[styles.shieldBadge, { backgroundColor: c.accent }]}>
              <Ionicons name="shield-outline" size={40} color={c.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No tokens yet</Text>
            <Text style={[styles.emptySubtitle, { color: c.textMuted }]}>
              Add a security token to protect your accounts
            </Text>
          </View>
        )}

        {/* Pending Approvals section */}
        {/* {isTokenSetup && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Pending Approvals</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/logs')}>
                <Text style={[styles.viewAll, { color: c.primary }]}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.approvalCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.approvalRow}>
                <View style={[styles.approvalIcon, { backgroundColor: c.accent }]}>
                  <Ionicons name="desktop-outline" size={20} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.approvalTitle, { color: c.text }]}>Login attempt from new device</Text>
                  <Text style={[styles.approvalSub, { color: c.textMuted }]}>macOS · Chrome</Text>
                </View>
              </View>
              <View style={styles.approvalActions}>
                <TouchableOpacity style={[styles.denyBtn, { borderColor: c.error }]}>
                  <Text style={[styles.denyText, { color: c.error }]}>Deny</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.approveBtn, { backgroundColor: c.primary }]}>
                  <Text style={styles.approveText}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )} */}
      </ScrollView>

      {/* FAB */}
      <View style={styles.fabContainer}>
        <Pressable
          onPress={() => router.push('/add-token')}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: c.primary },
            pressed && { opacity: 0.88, transform: [{ scale: 0.95 }] },
          ]}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>

      {pickerOpen && (
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => {
            setShowCountryPicker(false);
            setShowLanguagePicker(false);
          }}
        />
      )}

      {showCountryPicker && (
        <View style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>Select Country</Text>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)} style={styles.sheetCloseBtn}>
              <Ionicons name="close" size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {COUNTRIES.map((item) => {
              const selected = item.code === country;
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.sheetItem, selected && { backgroundColor: c.accent }]}
                  onPress={() => {
                    setCountry(item.code);
                    setShowCountryPicker(false);
                  }}
                >
                  <View style={styles.sheetItemLeft}>
                    <Text style={styles.sheetFlag}>{item.flag}</Text>
                    <Text style={[styles.sheetItemLabel, { color: selected ? c.primary : c.text }]}>
                      {item.name}
                    </Text>
                  </View>
                  {selected && <Ionicons name="checkmark" size={18} color={c.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {showLanguagePicker && (
        <View style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>Select Language</Text>
            <TouchableOpacity onPress={() => setShowLanguagePicker(false)} style={styles.sheetCloseBtn}>
              <Ionicons name="close" size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {LANGUAGES.map((item) => {
              const selected = item.code === language;
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.sheetItem, selected && { backgroundColor: c.accent }]}
                  onPress={() => {
                    setLanguage(item.code);
                    setShowLanguagePicker(false);
                  }}
                >
                  <Text style={[styles.sheetItemLabel, { color: selected ? c.primary : c.text }]}>
                    {item.name}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color={c.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  watermark: {
    position: 'absolute',
    width: 220,
    height: 220,
    bottom: -30,
    right: -30,
    opacity: 0.05,
    tintColor: undefined,
  },

  /* Header */
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  headerFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flex: 1,
    minHeight: 38,
  },
  filterFlag: {
    fontSize: 16,
  },
  filterText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: { padding: 12, paddingBottom: 100 },

  /* Token card */
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  issuerName: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  secondsLabel: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  accountLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 10,
  },

  /* Progress bar */
  progressTrack: {
    height: 5,
    borderRadius: 99,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },

  /* Digit cells */
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  digits: { flexDirection: 'row', gap: 4, flex: 1 },
  digitCell: {
    width: 30,
    height: 38,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    fontSize: 20,
  },
  copyBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Empty state */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
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

  /* Approvals section */
  section: { marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  viewAll: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  approvalCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  approvalIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalTitle: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  approvalSub: { fontSize: 12, marginTop: 2, fontFamily: 'Inter_400Regular' },
  approvalActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  denyBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  denyText: { fontSize: 13, fontWeight: '500', fontFamily: 'Inter_500Medium' },
  approveBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  approveText: { color: '#fff', fontSize: 13, fontWeight: '500', fontFamily: 'Inter_500Medium' },

  /* FAB */
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'flex-end',
    gap: 8,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 55,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '65%',
    zIndex: 60,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  sheetCloseBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetList: {
    paddingBottom: 18,
  },
  sheetItem: {
    minHeight: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetFlag: {
    fontSize: 18,
  },
  sheetItemLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});
