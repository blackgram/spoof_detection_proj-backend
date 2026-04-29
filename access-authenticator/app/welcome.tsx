import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { COUNTRIES, LANGUAGES } from '@/constants/preferences';
import { usePreferences } from '@/context/PreferencesContext';
import { useAppColors } from '@/hooks/use-app-colors';

export default function WelcomeScreen() {
  const c = useAppColors();
  const router = useRouter();
  const { country, language, completeOnboarding } = usePreferences();

  const [selectedCountry, setSelectedCountry] = useState(country);
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedCountryItem = useMemo(
    () => COUNTRIES.find((item) => item.code === selectedCountry) ?? COUNTRIES[0],
    [selectedCountry],
  );
  const selectedLanguageItem = useMemo(
    () => LANGUAGES.find((item) => item.code === selectedLanguage) ?? LANGUAGES[0],
    [selectedLanguage],
  );

  const pickerOpen = showCountryPicker || showLanguagePicker;

  const onContinue = () => {
    if (submitting) return;
    setSubmitting(true);
    completeOnboarding(selectedCountry, selectedLanguage);
    router.replace('/onboarding-success');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: c.text }]}>Welcome</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          Select your country and language to get started
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: c.textMuted }]}>Country</Text>
          <TouchableOpacity
            style={[styles.selectBtn, { borderColor: c.border, backgroundColor: c.surface }]}
            onPress={() => {
              setShowLanguagePicker(false);
              setShowCountryPicker((prev) => !prev);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.rowStart}>
              <View style={[styles.flagBadge, { backgroundColor: c.accent }]}>
                <Text style={styles.flag}>{selectedCountryItem.flag}</Text>
              </View>
              <Text style={[styles.selectText, { color: c.text }]}>{selectedCountryItem.name}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: c.textMuted }]}>Language</Text>
          <TouchableOpacity
            style={[styles.selectBtn, { borderColor: c.border, backgroundColor: c.surface }]}
            onPress={() => {
              setShowCountryPicker(false);
              setShowLanguagePicker((prev) => !prev);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.rowStart}>
              <View style={[styles.flagBadge, { backgroundColor: c.accent }]}>
                <Text style={styles.flag}>🌐</Text>
              </View>
              <Text style={[styles.selectText, { color: c.text }]}>{selectedLanguageItem.name}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={c.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.bottomBar, { borderTopColor: c.border, backgroundColor: c.surface }]}>
        <TouchableOpacity
          onPress={onContinue}
          activeOpacity={0.9}
          style={[styles.continueBtn, { backgroundColor: c.primary }]}
        >
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>
      </View>

      {pickerOpen && (
        <Pressable
          style={styles.overlay}
          onPress={() => {
            setShowCountryPicker(false);
            setShowLanguagePicker(false);
          }}
        />
      )}

      {showCountryPicker && (
        <View style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {COUNTRIES.map((item) => {
              const selected = item.code === selectedCountry;
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.sheetItem, selected && { backgroundColor: c.accent }]}
                  onPress={() => {
                    setSelectedCountry(item.code);
                    setShowCountryPicker(false);
                  }}
                >
                  <View style={styles.rowStart}>
                    <Text style={styles.flag}>{item.flag}</Text>
                    <Text style={[styles.sheetItemText, { color: selected ? c.primary : c.text }]}>
                      {item.name}
                    </Text>
                  </View>
                  {selected ? <Ionicons name="checkmark" size={18} color={c.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {showLanguagePicker && (
        <View style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {LANGUAGES.map((item) => {
              const selected = item.code === selectedLanguage;
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.sheetItem, selected && { backgroundColor: c.accent }]}
                  onPress={() => {
                    setSelectedLanguage(item.code);
                    setShowLanguagePicker(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, { color: selected ? c.primary : c.text }]}>
                    {item.name}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={18} color={c.primary} /> : null}
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
  content: { paddingHorizontal: 24, paddingTop: 22 },
  title: { fontSize: 44, lineHeight: 50, fontFamily: 'Inter_700Bold' },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: 'Inter_400Regular',
    marginBottom: 32,
  },
  fieldGroup: { marginBottom: 18 },
  label: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', marginBottom: 10 },
  selectBtn: {
    height: 86,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flagBadge: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: { fontSize: 30 },
  selectText: { fontSize: 17, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  bottomBar: {
    marginTop: 'auto',
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  continueBtn: {
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { color: '#fff', fontSize: 17, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
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
    maxHeight: '60%',
    zIndex: 30,
    paddingBottom: 12,
  },
  sheetItem: {
    minHeight: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetItemText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter_500Medium',
  },
});
