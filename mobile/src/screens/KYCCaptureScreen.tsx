import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { kycOnboard, kycVerify, updateLimit, type VerificationResult } from '../api/kyc';
import { transfer } from '../api/transactions';
import { registerDeviceKey } from '../api/deviceAuth';
import { generateAndStoreKey } from '../lib/deviceKey';
import ResultDisplay from '../components/ResultDisplay';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'KYCCapture'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function KYCCaptureScreen() {
  const { user, customerId, completeKYC, completeKYCWithCustomerId, setBiometricsForUsername, getDeviceId } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const params = (route.params ?? {}) as {
    mode: 'onboarding' | 'verification';
    reason: 'transfer' | 'limit' | 'biometrics';
    bvn?: string;
    name?: string;
    pendingLimitNg?: number;
    pendingTransfer?: { amount_ngn: number; beneficiary_account_number: string };
  };

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOnboarding = params.mode === 'onboarding';
  const handleBack = () => navigation.goBack();

  if (!isOnboarding && !customerId) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.title}>Complete KYC first</Text>
          <Text style={styles.message}>
            You need to complete KYC onboarding (BVN and reference photo) before you can verify with a selfie.
          </Text>
          <Pressable style={styles.primaryButton} onPress={handleBack}>
            <Text style={styles.primaryButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission?.granted]);

  const resetToTransfer = () => {
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'Transfer', params: { kycSuccess: true } },
      ],
    });
  };

  const resetToSettings = () => {
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'Settings', params: { limitIncreased: true } },
      ],
    });
  };

  const resetToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const onSuccess = async () => {
    if (params.reason === 'transfer') {
      const pending = params.pendingTransfer;
      if (pending && customerId) {
        try {
          await transfer({
            sender_customer_id: customerId,
            beneficiary_account_number: pending.beneficiary_account_number,
            amount_ngn: pending.amount_ngn,
            audit: {
              user_id: user?.userId ?? customerId,
              device_id: getDeviceId(),
              public_key_id: 'poc',
              nonce: `n-${Date.now()}`,
              transaction_hash: `h-${Date.now()}`,
              digital_signature: 's-poc',
              biometric_modality: 'FACE',
            },
          });
        } catch (e) {
          Alert.alert('Transfer failed', e instanceof Error ? e.message : 'Please try again.', [
            { text: 'OK', onPress: resetToTransfer },
          ]);
          return;
        }
      }
      resetToTransfer();
      return;
    }
    if (params.reason === 'limit') {
      const pending = params.pendingLimitNg;
      if (pending != null && customerId) {
        try {
          await updateLimit(customerId, pending);
          Alert.alert(
            'Limit updated',
            `Your daily transfer limit has been set to ₦ ${Math.round(pending).toLocaleString()}.`,
            [{ text: 'OK', onPress: resetToSettings }]
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to save limit';
          const isNotFound =
            msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('customer not found');
          const userMessage = isNotFound
            ? 'We couldn’t save your limit. Your session may have expired or the server was restarted. Please go to Settings → Adjust limits and try again; you may need to complete KYC again.'
            : msg;
          Alert.alert('Error', userMessage, [
            { text: 'OK', onPress: resetToSettings },
          ]);
        }
      } else {
        resetToSettings();
      }
      return;
    }
    if (params.reason === 'biometrics') {
      resetToHome();
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || !permission?.granted) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
      });
      if (photo?.uri) setCapturedUri(photo.uri);
    } catch (e) {
      Alert.alert('Error', 'Failed to capture. Please try again.');
    }
  };

  const handleUsePhoto = async () => {
    if (!capturedUri) return;
    if (isOnboarding) {
      if (!params.bvn?.trim()) {
        setError('Missing BVN. Go back and enter your BVN.');
        return;
      }
      setIsSubmitting(true);
      setError(null);
      setResult(null);
      try {
        const data = await kycOnboard({
          bvn: params.bvn.trim(),
          name: params.name ?? user?.name ?? 'Customer',
          referenceImageUri: capturedUri,
          ...(customerId ? { customerId } : {}),
        });
        await completeKYCWithCustomerId(data.customer_id);

        if (params.reason === 'biometrics') {
          try {
            console.log('[KYC Biometrics] step 1 → generateAndStoreKey customer_id=', data.customer_id);
            const { publicKeyB64 } = await generateAndStoreKey();
            console.log('[KYC Biometrics] step 2 → registerDeviceKey (public_key_len=', publicKeyB64?.length ?? 0, ')');
            await registerDeviceKey(data.customer_id, publicKeyB64);
            const username = user?.name?.trim();
            if (username) {
              await setBiometricsForUsername(username, data.customer_id);
            }
            console.log('[KYC Biometrics] step 3 → setBiometricsForUsername done. Biometrics enabled successfully');
            Alert.alert(
              'Biometrics enabled',
              'You can now sign in with Face ID or fingerprint next time.',
              [{ text: 'OK', onPress: resetToHome }]
            );
          } catch (bioErr) {
            const msg =
              bioErr instanceof Error
                ? bioErr.message
                : typeof bioErr === 'object' && bioErr !== null && ('message' in bioErr || 'error' in bioErr)
                  ? [(bioErr as { message?: string; error?: string }).message, (bioErr as { message?: string; error?: string }).error].filter(Boolean).join(': ')
                  : String(bioErr);
            console.error('[KYC Biometrics] Device key registration failed:', msg);
            Alert.alert(
              'KYC complete',
              `Identity verification is done. Biometric sign-in could not be set up. ${msg || 'Use your password to sign in for now.'}`,
              [{ text: 'OK', onPress: resetToHome }]
            );
          }
          setIsSubmitting(false);
          return;
        }

        Alert.alert(
          'KYC onboarding complete',
          'You can now complete your transfer or limit increase.',
          [{ text: 'OK', onPress: onSuccess }]
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Onboarding failed');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!customerId) {
        setError('Complete KYC onboarding first.');
        return;
      }
      setIsSubmitting(true);
      setError(null);
      setResult(null);
      try {
        const data = await kycVerify(customerId, capturedUri);
        setResult(data);
        if (data.overall_result === 'pass') {
          await completeKYC();
          Alert.alert(
            'Verification successful',
            'You can now complete your transfer or limit increase.',
            [{ text: 'OK', onPress: onSuccess }]
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
    setResult(null);
    setError(null);
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.message}>Camera access is required to capture your photo.</Text>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Allow camera</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={handleBack}>
            <Text style={styles.cancelButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (capturedUri && !result && !error) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.previewWrapper}>
          <Image source={{ uri: capturedUri }} style={styles.fullPreview} resizeMode="cover" />
          <View style={styles.previewOverlay}>
            <Text style={styles.previewHint}>
              {isOnboarding ? 'Use this as your reference photo?' : 'Use this photo for verification?'}
            </Text>
            {isSubmitting ? (
              <ActivityIndicator size="large" color="#fff" style={{ marginVertical: 16 }} />
            ) : (
              <View style={styles.previewActions}>
                <Pressable
                  style={({ pressed }) => [styles.usePhotoButton, pressed && styles.buttonPressed]}
                  onPress={handleUsePhoto}
                >
                  <Text style={styles.primaryButtonText}>Use photo</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.retakeButton, pressed && styles.buttonPressed]}
                  onPress={handleRetake}
                >
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  if (result || error) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.resultContainer}>
          <ResultDisplay result={result} isLoading={false} error={error} />
          <Pressable style={styles.retakeButton} onPress={handleRetake}>
            <Text style={styles.retakeButtonText}>Try again</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={handleBack}>
            <Text style={styles.cancelButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraFullScreen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        ref={cameraRef}
        facing="front"
      />
      <View style={styles.faceOvalOverlay} pointerEvents="none">
        <View style={styles.faceOval} />
        <Text style={styles.faceOvalHint}>
          {isOnboarding ? 'Position your face in the oval' : 'Position your face for verification'}
        </Text>
      </View>
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
      </SafeAreaView>
      <SafeAreaView style={styles.cameraControls} edges={['bottom', 'left', 'right']}>
        <Text style={styles.captureHint}>
          {isOnboarding ? 'Capture a well-lit, clear photo of your face' : 'Capture a live selfie'}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.captureButton, pressed && styles.captureButtonPressed]}
          onPress={handleCapture}
        >
          <View style={styles.captureButtonInner} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12 },
  message: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  cameraFullScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  faceOvalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceOval: {
    width: Math.min(280, SCREEN_WIDTH * 0.75),
    height: Math.min(360, SCREEN_HEIGHT * 0.45),
    borderRadius: 140,
    borderWidth: 3,
    borderColor: colors.primaryGlow,
    backgroundColor: 'transparent',
  },
  faceOvalHint: {
    position: 'absolute',
    bottom: 120,
    color: 'rgba(255,255,255,0.95)',
    fontSize: 16,
    fontWeight: '500',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  captureHint: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background,
    borderWidth: 4,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonPressed: { opacity: 0.9 },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
  },
  previewWrapper: { flex: 1 },
  fullPreview: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  previewHint: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  previewActions: { flexDirection: 'row', gap: spacing.md },
  usePhotoButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: radius.md,
  },
  retakeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: radius.md,
  },
  retakeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonPressed: { opacity: 0.9 },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: { marginTop: spacing.md },
  cancelButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  errorBanner: {
    backgroundColor: colors.errorBg,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: radius.md,
  },
  errorText: { color: colors.error, fontSize: 14 },
  resultContainer: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
});
