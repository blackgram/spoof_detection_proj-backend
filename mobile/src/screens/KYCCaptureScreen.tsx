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
import type { KycReason } from '../navigation/AppNavigator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { kycOnboard, kycVerify, updateLimit } from '../api/kyc';
import { transfer } from '../api/transactions';
import { queryClient } from '../query/queryClient';
import { queryKeys } from '../query/keys';
import { registerDeviceKey } from '../api/deviceAuth';
import { setupTotpForCustomer } from '../api/totpSetup';
import { generateAndStoreKey } from '../lib/deviceKey';
import { TOTP_ACCOUNTS_KEY } from '../lib/totpSecureStore';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'KYCCapture'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const OVAL_W = Math.min(260, SCREEN_WIDTH * 0.65);
const OVAL_H = Math.min(340, SCREEN_HEIGHT * 0.42);

type ScreenState = 'camera' | 'preview' | 'processing' | 'success' | 'error';

const isRegistrationOrDeviceChange = (r: KycReason) =>
  r === 'registration' || r === 'device_change';

export default function KYCCaptureScreen() {
  const {
    user,
    customerId,
    completeKYC,
    completeKYCWithCustomerId,
    setBiometricsForUsername,
    loginAfterRegistration,
    getDeviceId,
    setLastUsernameForLogin,
  } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const params = (route.params ?? {}) as {
    mode: 'onboarding' | 'verification';
    reason: KycReason;
    bvn?: string;
    name?: string;
    pendingLimitNg?: number;
    pendingTransfer?: { amount_ngn: number; beneficiary_account_number: string };
    customerId?: string;
    registrationUsername?: string;
  };

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>('camera');
  const [processingText, setProcessingText] = useState('Verifying your identity...');
  const [errorMessage, setErrorMessage] = useState('');
  const [biometricOptInPending, setBiometricOptInPending] = useState(false);
  const [successRegistrationCustomerId, setSuccessRegistrationCustomerId] = useState<string | null>(null);
  const [successRegistrationUsername, setSuccessRegistrationUsername] = useState<string | null>(null);

  const isOnboarding = params.mode === 'onboarding';
  const handleBack = () => navigation.goBack();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission?.granted]);

  // --- Navigation helpers ---
  const resetToTransfer = () => {
    navigation.reset({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'Transfer', params: { kycSuccess: true } }],
    });
  };

  const resetToSettings = () => {
    // We're inside SettingsStack (Profile tab); reset this stack to Settings only
    navigation.reset({
      index: 0,
      routes: [{ name: 'Settings', params: { limitIncreased: true } }],
    });
  };

  const resetToHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const handleRegistrationSuccessContinue = async () => {
    const cid = successRegistrationCustomerId;
    const uname = successRegistrationUsername?.trim();
    if (cid && uname) {
      await setLastUsernameForLogin(uname);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    setSuccessRegistrationCustomerId(null);
    setSuccessRegistrationUsername(null);
    setBiometricOptInPending(false);
  };

  const onSuccessContinue = async () => {
    if (isRegistrationOrDeviceChange(params.reason)) {
      await handleRegistrationSuccessContinue();
      return;
    }
    if (params.reason === 'token_setup') {
      resetToSettings();
      return;
    }
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
          await queryClient.invalidateQueries({ queryKey: queryKeys.accounts(customerId) });
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
        } catch {}
      }
      resetToSettings();
      return;
    }
    resetToHome();
  };

  // --- Capture + submit ---
  const handleCapture = async () => {
    if (!cameraRef.current || !permission?.granted) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, base64: false });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setScreenState('preview');
      }
    } catch {
      Alert.alert('Error', 'Failed to capture. Please try again.');
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
    setScreenState('camera');
    setErrorMessage('');
  };

  const handleSubmit = async () => {
    if (!capturedUri) return;
    setScreenState('processing');

    if (isOnboarding) {
      if (!params.bvn?.trim()) {
        setErrorMessage('Missing BVN.');
        setScreenState('error');
        return;
      }
      const effectiveCustomerId = params.customerId ?? customerId ?? undefined;
      setProcessingText('Setting up your profile...');
      try {
        const data = await kycOnboard({
          bvn: params.bvn.trim(),
          name: params.name ?? user?.name ?? 'Customer',
          referenceImageUri: capturedUri,
          ...(effectiveCustomerId ? { customerId: effectiveCustomerId } : {}),
        });
        await completeKYCWithCustomerId(data.customer_id);

        if (params.reason === 'biometrics') {
          setProcessingText('Enabling biometric sign-in...');
          try {
            const { publicKeyB64 } = await generateAndStoreKey();
            await registerDeviceKey(data.customer_id, publicKeyB64);
            const username = user?.name?.trim();
            if (username) {
              await setBiometricsForUsername(username, data.customer_id);
            }
          } catch (bioErr) {
            console.warn('[KYC] Biometric setup failed, continuing:', bioErr);
          }
        }

        if (params.reason === 'token_setup') {
          setProcessingText('Setting up your software token...');
          try {
            const username = user?.name?.trim() ?? params.name ?? 'Customer';
            const resp = await setupTotpForCustomer(data.customer_id, username);
            const raw = await SecureStore.getItemAsync(TOTP_ACCOUNTS_KEY);
            const existing = raw ? JSON.parse(raw) : [];
            const newAccount = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              label: username,
              issuer: 'Access Bank',
              secret: resp.totp_secret,
            };
            existing.push(newAccount);
            await SecureStore.setItemAsync(TOTP_ACCOUNTS_KEY, JSON.stringify(existing));
          } catch (totpErr) {
            console.warn('[KYC] TOTP setup failed:', totpErr);
            setErrorMessage(
              totpErr instanceof Error ? totpErr.message : 'Token setup failed'
            );
            setScreenState('error');
            return;
          }
        }

        if (isRegistrationOrDeviceChange(params.reason)) {
          setProcessingText('Setting up device security...');
          try {
            const { publicKeyB64 } = await generateAndStoreKey();
            await registerDeviceKey(data.customer_id, publicKeyB64);
          } catch (keyErr) {
            console.warn('[KYC] Device key setup failed, continuing:', keyErr);
          }
          setSuccessRegistrationCustomerId(data.customer_id);
          setSuccessRegistrationUsername(params.registrationUsername ?? params.name ?? '');
          setBiometricOptInPending(true);
        }

        setScreenState('success');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Identity verification failed');
        setScreenState('error');
      }
    } else {
      if (!customerId) {
        setErrorMessage('Complete KYC onboarding first.');
        setScreenState('error');
        return;
      }
      setProcessingText('Verifying your identity...');
      try {
        const data = await kycVerify(customerId, capturedUri);
        if (data.overall_result === 'pass') {
          await completeKYC();
          setScreenState('success');
        } else {
          setErrorMessage('Verification did not pass. Please try again with better lighting.');
          setScreenState('error');
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Verification failed');
        setScreenState('error');
      }
    }
  };

  // --- Permission states ---
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
          <Text style={styles.permTitle}>Camera access required</Text>
          <Text style={styles.permMessage}>
            We need camera access to capture your photo for identity verification.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={requestPermission}
          >
            <Text style={styles.primaryButtonText}>Allow Camera</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={handleBack}>
            <Text style={styles.linkButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- Processing state ---
  if (screenState === 'processing') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 20 }} />
          <Text style={styles.processingTitle}>{processingText}</Text>
          <Text style={styles.processingSubtitle}>This may take a moment</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- Success state ---
  if (screenState === 'success') {
    if (biometricOptInPending && successRegistrationCustomerId && successRegistrationUsername) {
      return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.centered}>
            <View style={styles.successCircle}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Identity Verified</Text>
            <Text style={styles.successMessage}>
              Would you like to enable biometrics? (Recommended)
            </Text>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              onPress={async () => {
                await setBiometricsForUsername(successRegistrationUsername, successRegistrationCustomerId);
                setBiometricOptInPending(false);
              }}
            >
              <Text style={styles.primaryButtonText}>Yes</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={() => setBiometricOptInPending(false)}
            >
              <Text style={styles.secondaryButtonText}>No</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    const successTitle =
      params.reason === 'token_setup'
        ? 'Token Activated'
        : params.reason === 'biometrics'
          ? 'Biometrics Enabled'
          : 'Identity Verified';
    const successMessage =
      params.reason === 'token_setup'
        ? 'Your software token has been set up. You can view codes in the Token tab.'
        : params.reason === 'biometrics'
          ? 'You can now sign in with Face ID or fingerprint.'
          : 'Your identity has been successfully verified. You can now proceed.';

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <View style={styles.successCircle}>
            <Text style={styles.successCheck}>✓</Text>
          </View>
          <Text style={styles.successTitle}>{successTitle}</Text>
          <Text style={styles.successMessage}>{successMessage}</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={onSuccessContinue}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- Error state ---
  if (screenState === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <View style={styles.errorCircle}>
            <Text style={styles.errorX}>✕</Text>
          </View>
          <Text style={styles.errorTitle}>Verification Failed</Text>
          <Text style={styles.errorMsg}>{errorMessage}</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={handleRetake}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={handleBack}>
            <Text style={styles.linkButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- Preview state ---
  if (screenState === 'preview' && capturedUri) {
    return (
      <View style={styles.previewFull}>
        <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="cover" />
        <View style={styles.previewGradient}>
          <SafeAreaView edges={['top']} style={styles.previewTopBar}>
            <Pressable onPress={handleRetake}>
              <Text style={styles.previewBackText}>← Retake</Text>
            </Pressable>
          </SafeAreaView>

          <SafeAreaView edges={['bottom']} style={styles.previewBottomBar}>
            <Text style={styles.previewHint}>
              {isOnboarding
                ? ''
                : 'This photo will be used for verification'}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.usePhotoButton, pressed && styles.buttonPressed]}
              onPress={handleSubmit}
            >
              <Text style={styles.primaryButtonText}>Use Photo</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.retakeButton, pressed && styles.buttonPressed]}
              onPress={handleRetake}
            >
              <Text style={styles.retakeText}>Retake</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </View>
    );
  }

  // --- Camera state ---
  return (
    <View style={styles.cameraFull}>
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing="front" />

      {/* Face guide overlay */}
      <View style={styles.overlayContainer} pointerEvents="none">
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.faceOval}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      <SafeAreaView style={styles.camTopBar} edges={['top']}>
        <Pressable onPress={handleBack} style={styles.camBackBtn}>
          <Text style={styles.camBackText}>←</Text>
        </Pressable>
        <Text style={styles.camTitle}>
          {isOnboarding ? 'Reference Photo' : 'Verification'}
        </Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <SafeAreaView style={styles.camBottomBar} edges={['bottom']}>
        <Text style={styles.camHint}>
          Position your face within the frame
        </Text>
        <Pressable
          style={({ pressed }) => [styles.shutterOuter, pressed && styles.shutterPressed]}
          onPress={handleCapture}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  /* Permission */
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  permMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },

  /* Buttons */
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonPressed: { opacity: 0.85 },
  linkButton: { marginTop: spacing.md },
  linkButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    marginTop: spacing.sm,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 16, fontWeight: '600' },

  /* Processing */
  processingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  /* Success */
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successCheck: { fontSize: 40, color: '#fff', fontWeight: '700' },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  /* Error */
  errorCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  errorX: { fontSize: 36, color: '#fff', fontWeight: '700' },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  errorMsg: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  /* Camera */
  cameraFull: { flex: 1, backgroundColor: '#000' },

  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: OVAL_H,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  faceOval: {
    width: OVAL_W,
    height: OVAL_H,
    borderRadius: OVAL_W / 2,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primary,
    borderTopLeftRadius: 20,
  },
  cornerTR: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primary,
    borderTopRightRadius: 20,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primary,
    borderBottomLeftRadius: 20,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primary,
    borderBottomRightRadius: 20,
  },

  camTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  camBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camBackText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  camTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  camBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 24,
  },
  camHint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterPressed: { opacity: 0.7 },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },

  /* Preview */
  previewFull: { flex: 1, backgroundColor: '#000' },
  previewImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  previewGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  previewTopBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  previewBackText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  previewBottomBar: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingTop: spacing.lg,
  },
  previewHint: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  usePhotoButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
  },
  retakeButton: {
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  retakeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
