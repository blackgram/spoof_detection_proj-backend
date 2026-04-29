import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppColors } from '@/hooks/use-app-colors';
import { useTranslation } from '@/lib/i18n';

const AUTO_NAV_DELAY_MS = 2000;

export default function OnboardingSuccessScreen() {
  const c = useAppColors();
  const router = useRouter();
  const { t } = useTranslation();
  const redirectedRef = useRef(false);
  const bounceAnim = useRef(new Animated.Value(0)).current;

  const goHome = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace('/(tabs)');
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(goHome, AUTO_NAV_DELAY_MS);
    return () => clearTimeout(timer);
  }, [goHome]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -12,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounceAnim]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* outer light green ring + inner solid green circle, matching design */}
        <Animated.View style={[styles.outerRing, { transform: [{ translateY: bounceAnim }] }]}>
          <View style={styles.innerCircle}>
            <Ionicons name="checkmark" size={44} color="#fff" strokeWidth={3} />
          </View>
        </Animated.View>

        <Text style={[styles.title, { color: c.text }]}>{t('onboardingSuccess.title')}</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {t('onboardingSuccess.subtitle')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  outerRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#bbf7d0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  innerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    lineHeight: 30,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
