import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppColors } from '@/hooks/use-app-colors';
import { useTranslation } from '@/lib/i18n';

export default function AddTokenScreen() {
  const c = useAppColors();
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>{t('addToken.title')}</Text>
      </View>

      {/* Body */}
      <View style={styles.content}>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {t('addToken.subtitle')}
        </Text>

        <View style={styles.options}>
          {/* QR option */}
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: c.surface, borderColor: c.border }]}
            activeOpacity={0.92}
            onPress={() => router.push('/scan')}
          >
            <View style={[styles.iconWrap, { backgroundColor: c.accent }]}>
              <Ionicons name="qr-code-outline" size={24} color={c.primary} />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: c.text }]}>{t('addToken.scan')}</Text>
            </View>
          </TouchableOpacity>

          {/* Manual option */}
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: c.surface, borderColor: c.border }]}
            activeOpacity={0.92}
            onPress={() => router.push('/manual-setup')}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="keypad-outline" size={24} color={c.orange} />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: c.text }]}>{t('addToken.manual')}</Text>
              <Text style={[styles.optionHint, { color: c.textMuted }]}>
                {t('addToken.manualHint')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_500Medium',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 20,
  },
  options: {
    gap: 12,
  },
  optionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  optionHint: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
