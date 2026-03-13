import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import CameraCapture from '../components/CameraCapture';
import ResultDisplay from '../components/ResultDisplay';
import { useAuth } from '../context/AuthContext';
import { getKycStatus, kycOnboard, kycVerify, type VerificationResult } from '../api/kyc';
import { colors } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'KYCFlow'>;

export default function KYCFlowScreen() {
  const { user, customerId, completeKYC, completeKYCWithCustomerId } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { mode: paramMode, reason } = (route.params ?? {}) as {
    mode: 'onboarding' | 'verification';
    reason: 'transfer' | 'limit';
  };
  const onCancel = () => navigation.goBack();

  const onSuccess = () => {
    if (reason === 'transfer') {
      navigation.navigate('Transfer', { kycSuccess: true });
    } else {
      navigation.navigate('Settings', { limitIncreased: true });
    }
  };

  const [bvn, setBvn] = useState('');
  const [referenceImageUri, setReferenceImageUri] = useState<string | null>(null);
  const [selfieImageUri, setSelfieImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needStatusCheck = paramMode === 'verification' && !!customerId;
  const [statusLoading, setStatusLoading] = useState(needStatusCheck);
  const [resolvedMode, setResolvedMode] = useState<'onboarding' | 'verification' | null>(
    needStatusCheck ? null : paramMode
  );

  React.useEffect(() => {
    if (!needStatusCheck) {
      setResolvedMode(paramMode);
      return;
    }
    getKycStatus(customerId!)
      .then((status) => {
        setResolvedMode(status.kyc_completed ? 'verification' : 'onboarding');
      })
      .catch(() => setResolvedMode('onboarding'))
      .finally(() => setStatusLoading(false));
  }, [customerId, paramMode, needStatusCheck]);

  const isOnboarding = resolvedMode === 'onboarding';

  const handleOnboard = async () => {
    if (!bvn.trim()) {
      setError('Please enter your BVN');
      return;
    }
    if (!referenceImageUri) {
      setError('Please capture a well-lit, clear image of your face');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await kycOnboard({
        bvn: bvn.trim(),
        name: user?.name ?? 'Customer',
        referenceImageUri,
      });
      await completeKYCWithCustomerId(data.customer_id);
      Alert.alert(
        'KYC onboarding complete',
        'You can now complete your transfer or limit increase.',
        [{ text: 'OK', onPress: () => onSuccess() }]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onboarding failed');
      console.error('KYC onboard error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!customerId) {
      setError('Complete KYC onboarding first.');
      return;
    }
    if (!selfieImageUri) {
      setError('Please capture your selfie');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await kycVerify(customerId, selfieImageUri);
      setResult(data);
      if (data.overall_result === 'pass') {
        await completeKYC();
        Alert.alert(
          'Verification successful',
          'You can now complete your transfer or limit increase.',
          [{ text: 'OK', onPress: () => onSuccess() }]
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      console.error('KYC verify error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (statusLoading || (paramMode === 'verification' && resolvedMode === null)) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom', 'left', 'right']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (paramMode === 'verification' && !customerId) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.card}>
          <Text style={styles.title}>Complete KYC first</Text>
          <Text style={styles.message}>
            You need to complete KYC onboarding (BVN and reference image) before you can verify with a selfie.
          </Text>
          <Pressable style={styles.primaryButton} onPress={onCancel}>
            <Text style={styles.primaryButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isOnboarding) {
    const canSubmit = bvn.trim().length >= 10 && referenceImageUri && !isLoading;
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>KYC onboarding</Text>
            <Text style={styles.subtitle}>
              Enter your BVN and capture a well-lit, clear image of your face. This will be saved as your reference for future verification.
            </Text>
            <Text style={styles.label}>BVN</Text>
            <TextInput
              style={styles.input}
              placeholder="Bank Verification Number (11 digits)"
              placeholderTextColor={colors.textMuted}
              value={bvn}
              onChangeText={setBvn}
              keyboardType="number-pad"
              maxLength={11}
              editable={!isLoading}
            />
            <CameraCapture
              imageUri={referenceImageUri}
              onImageCapture={setReferenceImageUri}
              required
              label="Reference image (well-lit, clear face)"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  !canSubmit && styles.primaryButtonDisabled,
                  pressed && canSubmit && styles.primaryButtonPressed,
                ]}
                onPress={handleOnboard}
                disabled={!canSubmit}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Complete KYC onboarding</Text>
                )}
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Verification: selfie only
  const canVerify = !!selfieImageUri && !isLoading;
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Face verification</Text>
          <Text style={styles.subtitle}>
            Capture a live selfie. We'll run spoof detection and compare it to your saved reference.
          </Text>
          <CameraCapture
            imageUri={selfieImageUri}
            onImageCapture={setSelfieImageUri}
            required
          />
          {(result || error) && !isLoading && (
            <ResultDisplay result={result} isLoading={false} error={error} />
          )}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                !canVerify && styles.primaryButtonDisabled,
                pressed && canVerify && styles.primaryButtonPressed,
              ]}
              onPress={handleVerify}
              disabled={!canVerify}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify</Text>
              )}
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, color: colors.textSecondary },
  scrollContent: { padding: 24, paddingBottom: 48 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  message: { fontSize: 15, color: colors.textSecondary, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  errorText: { fontSize: 14, color: colors.error, marginBottom: 12 },
  actions: { marginTop: 20, gap: 12 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonPressed: { opacity: 0.9 },
  primaryButtonDisabled: { backgroundColor: colors.disabled },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: { alignItems: 'center', paddingVertical: 12 },
  cancelButtonText: { color: colors.primary, fontSize: 15 },
});
