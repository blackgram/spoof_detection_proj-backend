import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import Slider from '@react-native-community/slider';
import { useAuth } from '../context/AuthContext';
import { getKycStatus, MIN_LIMIT_NGN, MAX_LIMIT_NGN } from '../api/kyc';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Limit'>;

function formatLimit(value: number): string {
  return `₦ ${Math.round(value).toLocaleString()}`;
}

export default function LimitScreen() {
  const { kycCompleted, customerId } = useAuth();
  const navigation = useNavigation<Nav>();
  const [sliderValue, setSliderValue] = useState<number>(MIN_LIMIT_NGN);
  const [loading, setLoading] = useState(true);

  const loadLimit = useCallback(async () => {
    if (!customerId || !kycCompleted) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const status = await getKycStatus(customerId);
      const limit = status.current_limit_ngn ?? MIN_LIMIT_NGN;
      setSliderValue(limit);
    } catch {
      setSliderValue(MIN_LIMIT_NGN);
    } finally {
      setLoading(false);
    }
  }, [customerId, kycCompleted]);

  useFocusEffect(
    useCallback(() => {
      loadLimit();
    }, [loadLimit])
  );

  const handleSave = () => {
    const clamped = Math.round(Math.max(MIN_LIMIT_NGN, Math.min(MAX_LIMIT_NGN, sliderValue)));
    if (!kycCompleted) {
      navigation.navigate('KYCBvn', { reason: 'limit' });
      return;
    }
    if (!customerId) {
      Alert.alert('Complete KYC first', 'You need to complete KYC onboarding before adjusting your limit.');
      return;
    }
    navigation.navigate('KYCCapture', {
      mode: 'verification',
      reason: 'limit',
      pendingLimitNg: clamped,
    });
  };

  if (!kycCompleted || !customerId) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.message}>Complete KYC first to adjust your limit.</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('KYCBvn', { reason: 'limit' })}>
            <Text style={styles.primaryButtonText}>Start KYC</Text>
          </Pressable>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.card}>
        <Text style={styles.title}>Daily transfer limit</Text>
        <Text style={styles.hint}>Choose your limit. Saving will require face verification.</Text>
        <Text style={styles.limitValue}>{formatLimit(sliderValue)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={MIN_LIMIT_NGN}
          maximumValue={MAX_LIMIT_NGN}
          step={100000}
          value={sliderValue}
          onValueChange={setSliderValue}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        <Text style={styles.rangeHint}>₦100,000 – ₦50,000,000</Text>
        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: {
    margin: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  hint: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  limitValue: { fontSize: 28, fontWeight: '700', color: colors.primary, marginBottom: spacing.md },
  slider: { width: '100%', height: 40 },
  rangeHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonPressed: { opacity: 0.9 },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  message: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: radius.md,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backButton: { marginTop: spacing.lg },
  backButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  loadingText: { marginTop: spacing.sm, color: colors.textSecondary },
});
