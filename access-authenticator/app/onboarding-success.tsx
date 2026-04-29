import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppColors } from '@/hooks/use-app-colors';

const AUTO_NAV_DELAY_MS = 2000;

export default function OnboardingSuccessScreen() {
  const c = useAppColors();
  const router = useRouter();
  const redirectedRef = useRef(false);

  const goHome = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace('/(tabs)');
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(goHome, AUTO_NAV_DELAY_MS);
    return () => clearTimeout(timer);
  }, [goHome]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={[styles.successOuter, { backgroundColor: '#d7f5e1' }]}>
          <View style={[styles.successInner, { backgroundColor: '#05c451' }]}>
            <Ionicons name="checkmark" size={46} color="#fff" />
          </View>
        </View>
        <Text style={[styles.title, { color: c.text }]}>You are all set!</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          Get ready to manage your tokens securely
        </Text>
      </View>

      <View style={[styles.bottomBar, { borderTopColor: c.border, backgroundColor: c.surface }]}>
        <TouchableOpacity
          style={[styles.continueBtn, { backgroundColor: c.primary }]}
          activeOpacity={0.9}
          onPress={goHome}
        >
          <Text style={styles.continueText}>Continue now</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 24,
  },
  successOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  successInner: {
    width: 126,
    height: 126,
    borderRadius: 63,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 44,
    lineHeight: 50,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 18,
    lineHeight: 26,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  bottomBar: {
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
  continueText: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'Inter_500Medium',
  },
});
