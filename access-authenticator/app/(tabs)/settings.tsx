import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { FlagImage } from '@/components/flag-image';
import { useState, type ReactNode } from 'react';

import { COUNTRIES, LANGUAGES } from '@/constants/preferences';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/context/PreferencesContext';
import { useAppColors } from '@/hooks/use-app-colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/lib/i18n';

type SectionRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  rightNode?: ReactNode;
  accent?: string;
};

function SectionRow({ icon, title, subtitle, onPress, rightNode, accent }: SectionRowProps) {
  const c = useAppColors();

  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.sectionRow, !onPress && styles.sectionRowDisabled]}
    >
      <View style={[styles.sectionIcon, { backgroundColor: accent ?? c.accent }]}>
        <Ionicons name={icon} size={19} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionRowTitle, { color: c.text }]}>{title}</Text>
        <Text style={[styles.sectionRowSubtitle, { color: c.textMuted }]}>{subtitle}</Text>
      </View>
      <View style={styles.rightNodeWrap}>
        {rightNode ?? <Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { clearAllTokens } = useAuth();
  const {
    country,
    language,
    themeMode,
    biometricEnabled,
    setCountry,
    setLanguage,
    setThemeMode,
    setBiometricEnabled,
    resetPreferences,
  } = usePreferences();
  const c = useAppColors();
  const router = useRouter();
  const { t } = useTranslation();
  const selectedCountry = COUNTRIES.find((item) => item.code === country) ?? COUNTRIES[0];
  const selectedLanguage = LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0];

  const themeLabels: Record<'system' | 'light' | 'dark', string> = {
    system: t('settings.themeSystem'),
    light: t('settings.themeLight'),
    dark: t('settings.themeDark'),
  };

  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const pickerOpen = showCountryPicker || showLanguagePicker;

  const handleFactoryReset = () => {
    Alert.alert(
      t('settings.factoryResetTitle'),
      t('settings.factoryResetMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reset'),
          style: 'destructive',
          onPress: async () => {
            await clearAllTokens();
            resetPreferences();
            router.replace('/welcome');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Text style={[styles.headerTitle, { color: c.text }]}>{t('settings.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>{t('settings.section.appearance')}</Text>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>{t('settings.theme')}</Text>
            <View style={styles.themeRow}>
              {(['system', 'light', 'dark'] as const).map((option) => {
                const selected = themeMode === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setThemeMode(option)}
                    style={[
                      styles.themeBtn,
                      {
                        backgroundColor: selected ? c.primary : c.inputBackground,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        option === 'system'
                          ? 'desktop-outline'
                          : option === 'light'
                            ? 'sunny-outline'
                            : 'moon-outline'
                      }
                      size={16}
                      color={selected ? '#fff' : c.textMuted}
                    />
                    <Text
                      style={[
                        styles.themeBtnText,
                        { color: selected ? '#fff' : c.textMuted },
                      ]}
                    >
                      {themeLabels[option]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>{t('settings.section.localization')}</Text>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, paddingVertical: 2 }]}>
            <SectionRow
              icon="globe-outline"
              title={t('common.country')}
              subtitle={selectedCountry.name}
              onPress={() => setShowCountryPicker(true)}
              rightNode={<FlagImage code={selectedCountry.flag} width={24} height={16} />}
            />
            <View style={[styles.rowDivider, { backgroundColor: c.border }]} />
            <SectionRow
              icon="language-outline"
              title={t('common.language')}
              subtitle={selectedLanguage.name}
              onPress={() => setShowLanguagePicker(true)}
              accent="#FFF3E0"
              rightNode={<FlagImage code={selectedLanguage.flag} width={24} height={16} />}
            />
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>{t('settings.section.security')}</Text>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, paddingVertical: 2 }]}>
            <SectionRow
              icon="shield-checkmark-outline"
              title={t('settings.biometric')}
              subtitle={t('settings.biometricSubtitle')}
              rightNode={(
                <Switch
                  value={biometricEnabled}
                  onValueChange={setBiometricEnabled}
                  disabled
                  trackColor={{ false: c.inputBackground, true: c.primary }}
                  thumbColor="#fff"
                />
              )}
            />
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>{t('settings.section.about')}</Text>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, paddingVertical: 2 }]}>
            <SectionRow
              icon="information-circle-outline"
              title={t('settings.appInfo')}
              subtitle={t('settings.appVersion')}
              rightNode={<Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
            />
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>{t('settings.section.dangerZone')}</Text>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, paddingVertical: 2 }]}>
            <SectionRow
              icon="refresh-circle-outline"
              title={t('settings.factoryReset')}
              subtitle={t('settings.factoryResetSubtitle')}
              onPress={handleFactoryReset}
              accent="#FFF0F3"
              rightNode={<Ionicons name="warning-outline" size={18} color={c.error} />}
            />
          </View>
        </View>

      </ScrollView>

      {pickerOpen && (
        <TouchableOpacity
          activeOpacity={1}
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
            <Text style={[styles.sheetTitle, { color: c.text }]}>{t('common.selectCountry')}</Text>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
              <Ionicons name="close" size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.sheetList}>
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
                  <FlagImage code={item.flag} width={28} height={20} />
                  <Text style={[styles.sheetItemText, { color: selected ? c.primary : c.text }]}>{item.name}</Text>
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
            <Text style={[styles.sheetTitle, { color: c.text }]}>{t('common.selectLanguage')}</Text>
            <TouchableOpacity onPress={() => setShowLanguagePicker(false)}>
              <Ionicons name="close" size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.sheetList}>
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
                  <FlagImage code={item.flag} width={28} height={20} />
                  <Text style={[styles.sheetItemText, { color: selected ? c.primary : c.text }]}>{item.name}</Text>
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
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  scrollContent: { padding: 14, paddingBottom: Platform.OS === 'android' ? 56 : 38 },
  sectionWrap: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 7,
    paddingHorizontal: 2,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 10 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: {
    flex: 1,
    borderRadius: 10,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  themeBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  sectionRow: {
    minHeight: 66,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionRowDisabled: {
    opacity: 0.98,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  sectionRowSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  rightNodeWrap: {
    minHeight: 40,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDivider: { height: 1, marginHorizontal: 12 },
  accountLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  accountValue: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 6 },
  accountValueSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 20,
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
    zIndex: 30,
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  sheetList: { paddingBottom: 16 },
  sheetItem: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetItemText: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
});
