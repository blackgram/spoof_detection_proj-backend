import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';
import { useAppColors } from '@/hooks/use-app-colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '@/lib/i18n';

type BiometricGateProps = {
  title?: string;
};

export function BiometricGate({ title }: BiometricGateProps) {
  const c = useAppColors();
  const { t } = useTranslation();
  const { unlockWithBiometrics } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [failed, setFailed] = useState(false);

  const headerTitle = title ?? t('biometric.title');

  const startAuthentication = async () => {
    setIsAuthenticating(true);
    setFailed(false);
    const ok = await unlockWithBiometrics();
    setIsAuthenticating(false);
    if (!ok) {
      setFailed(true);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      void startAuthentication();
    }, 350);
    return () => clearTimeout(id);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Text style={[styles.headerTitle, { color: c.text }]}>{headerTitle}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: c.accent }]}>
          <Ionicons name="finger-print-outline" size={52} color={c.primary} />
          {isAuthenticating && <View style={[styles.pingRing, { borderColor: c.primary }]} />}
        </View>

        <Text style={[styles.title, { color: c.text }]}>
          {isAuthenticating ? t('biometric.authenticating') : t('biometric.verify')}
        </Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {failed
            ? t('biometric.failed')
            : isAuthenticating
              ? t('biometric.confirming')
              : t('biometric.idle')}
        </Text>
      </View>

      <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.surface }]}>
        <TouchableOpacity
          style={[styles.unlockBtn, { backgroundColor: c.primary }]}
          onPress={() => void startAuthentication()}
          disabled={isAuthenticating}
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-open-outline" size={16} color="#fff" />
              <Text style={styles.unlockText}>{t('common.unlock')}</Text>
            </>
          )}
        </TouchableOpacity>
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
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_500Medium' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pingRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 24,
    borderWidth: 4,
    opacity: 0.28,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 0,
    maxWidth: 290,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    borderTopWidth: 1,
    padding: 16,
  },
  unlockBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  unlockText: {
    fontSize: 15,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
});
