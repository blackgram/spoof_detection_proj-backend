import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { KycReason } from '../navigation/AppNavigator';
import { kycLivenessStart, kycLivenessVerify, type LivenessPrompt } from '../api/kyc';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'KYCLivenessMulti'>;

type CapturePhase = 'loading' | 'instruction' | 'capturing' | 'flash' | 'submitting' | 'success' | 'error';

const PROMPT_LABELS: Record<LivenessPrompt, string> = {
  look_straight: 'Look straight at the camera',
  turn_left: 'Turn your face slightly left',
  turn_right: 'Turn your face slightly right',
  smile: 'Smile naturally',
  blink: 'Blink naturally',
  nod: 'Nod gently',
};

const PROMPT_HINTS: Record<LivenessPrompt, string> = {
  look_straight: 'Center your face in the oval and hold still',
  turn_left: 'Keep your face in frame and hold still',
  turn_right: 'Keep your face in frame and hold still',
  smile: 'Hold your smile for auto-capture',
  blink: 'Blink once, then hold still',
  nod: 'Nod once, then hold still',
};

export default function KYCLivenessMultiScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { completeKYCWithCustomerId, setLastUsernameForLogin } = useAuth();
  const params = (route.params ?? {}) as {
    reason: KycReason;
    customerId?: string;
    username?: string;
  };

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<CapturePhase>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<LivenessPrompt[]>([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [frames, setFrames] = useState<{ uri: string; capturedAtMs: number }[]>([]);
  const [resultMessage, setResultMessage] = useState('');

  const customerId = params.customerId?.trim() || '';
  const username = params.username?.trim() || '';
  const currentPrompt = prompts[promptIndex];

  useEffect(() => {
    console.log('[KYCLivenessMulti] mounted', {
      reason: params.reason,
      customerId,
      username,
    });
  }, [params.reason, customerId, username]);

  useEffect(() => {
    console.log('[KYCLivenessMulti] phase', {
      phase,
      promptIndex,
      prompts: prompts.length,
      frames: frames.length,
      sessionId,
    });
  }, [phase, promptIndex, prompts.length, frames.length, sessionId]);

  const progressPct = useMemo(() => {
    if (!prompts.length) return 0;
    return ((promptIndex + (phase === 'flash' || phase === 'success' ? 1 : 0)) / prompts.length) * 100;
  }, [phase, promptIndex, prompts.length]);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    let cancelled = false;
    async function startSession() {
      if (!customerId) {
        setErrorMessage('Missing customer id. Please restart registration.');
        setPhase('error');
        return;
      }
      try {
        setPhase('loading');
        const data = await kycLivenessStart(customerId);
        if (cancelled) return;
        setSessionId(data.session_id);
        setPrompts(data.prompts);
        setPromptIndex(0);
        setFrames([]);
        setCountdown(3);
        console.log('[KYCLivenessMulti] session ready', {
          sessionId: data.session_id,
          prompts: data.prompts,
        });
        setPhase('instruction');
      } catch (e) {
        if (cancelled) return;
        setErrorMessage(e instanceof Error ? e.message : 'Failed to start liveness check.');
        setPhase('error');
      }
    }
    startSession();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    if (phase !== 'instruction') return;
    if (!currentPrompt) return;
    const id = setTimeout(() => {
      setCountdown(3);
      setPhase('capturing');
    }, 800);
    return () => clearTimeout(id);
  }, [phase, currentPrompt]);

  useEffect(() => {
    if (phase !== 'capturing') return;
    const id = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'capturing') return;
    if (countdown > 0) return;
    let cancelled = false;
    async function autoCapture() {
      try {
        const photo = await cameraRef.current?.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        if (cancelled) return;
        if (!photo?.uri) {
          throw new Error('Could not capture frame.');
        }
        setFrames((prev) => [...prev, { uri: photo.uri, capturedAtMs: Date.now() }]);
        console.log('[KYCLivenessMulti] frame captured', {
          prompt: currentPrompt,
          index: promptIndex,
          next_frames_count: frames.length + 1,
        });
        setPhase('flash');
      } catch (e) {
        if (cancelled) return;
        setErrorMessage(e instanceof Error ? e.message : 'Capture failed. Please retry.');
        setPhase('error');
      }
    }
    autoCapture();
    return () => {
      cancelled = true;
    };
  }, [countdown, phase]);

  useEffect(() => {
    if (phase !== 'flash') return;
    const id = setTimeout(() => {
      const isLast = promptIndex >= prompts.length - 1;
      if (isLast) {
        setPhase('submitting');
      } else {
        setPromptIndex((prev) => prev + 1);
        setPhase('instruction');
      }
    }, 500);
    return () => clearTimeout(id);
  }, [phase, promptIndex, prompts.length]);

  useEffect(() => {
    if (phase !== 'submitting') return;
    let cancelled = false;
    async function verify() {
      if (!sessionId || !customerId) {
        setErrorMessage('Missing liveness session. Please retry.');
        setPhase('error');
        return;
      }
      try {
        console.log('[KYCLivenessMulti] verifying session', {
          sessionId,
          customerId,
          frames: frames.length,
        });
        const data = await kycLivenessVerify({
          customerId,
          sessionId,
          frames,
        });
        if (cancelled) return;
        if (data.overall_result === 'pass') {
          await completeKYCWithCustomerId(customerId);
          if (username) {
            await setLastUsernameForLogin(username);
          }
          setResultMessage('Liveness passed. Continue to sign in.');
          console.log('[KYCLivenessMulti] verification pass', {
            sessionId,
            overall_result: data.overall_result,
            risk_flags: data.risk_flags,
          });
          setPhase('success');
          return;
        }
        console.log('[KYCLivenessMulti] verification non-pass', {
          sessionId,
          overall_result: data.overall_result,
          message: data.message,
          risk_flags: data.risk_flags,
        });
        setErrorMessage(data.message || 'Verification did not pass. Please retry.');
        setPhase('error');
      } catch (e) {
        console.log('[KYCLivenessMulti] verification error', e);
        if (cancelled) return;
        setErrorMessage(e instanceof Error ? e.message : 'Liveness verification failed.');
        setPhase('error');
      }
    }
    verify();
    return () => {
      cancelled = true;
    };
  }, [phase, sessionId, customerId, frames, completeKYCWithCustomerId, setLastUsernameForLogin, username]);

  const onRetry = async () => {
    if (!customerId) return;
    try {
      setPhase('loading');
      setErrorMessage('');
      const data = await kycLivenessStart(customerId);
      setSessionId(data.session_id);
      setPrompts(data.prompts);
      setPromptIndex(0);
      setFrames([]);
      setCountdown(3);
      setPhase('instruction');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to restart liveness session.');
      setPhase('error');
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom', 'left', 'right']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.title}>Camera permission required</Text>
          <Text style={styles.subtitle}>Allow camera access to continue KYC liveness verification.</Text>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Allow camera</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'loading' || phase === 'submitting') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.subtitle}>
            {phase === 'loading' ? 'Preparing liveness check...' : 'Verifying captured frames...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.successMark}>✓</Text>
          <Text style={styles.title}>KYC verification complete</Text>
          <Text style={styles.subtitle}>{resultMessage}</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.errorMark}>✕</Text>
          <Text style={styles.title}>Verification failed</Text>
          <Text style={styles.subtitle}>{errorMessage}</Text>
          <Pressable style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraRoot}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={styles.headerText}>KYC Liveness</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.promptCard}>
          <Text style={styles.promptStep}>
            Step {Math.min(promptIndex + 1, prompts.length)} of {prompts.length}
          </Text>
          <Text style={styles.promptTitle}>
            {currentPrompt ? PROMPT_LABELS[currentPrompt] : 'Follow the prompt'}
          </Text>
          <Text style={styles.promptHint}>
            {currentPrompt ? PROMPT_HINTS[currentPrompt] : 'Keep your face in frame'}
          </Text>
        </View>

        <View style={styles.ovalWrap}>
          <View style={[styles.oval, phase === 'flash' ? styles.ovalFlash : null]}>
            {phase === 'capturing' ? <Text style={styles.countdownText}>{countdown}</Text> : null}
            {phase === 'flash' ? <Text style={styles.capturedText}>Captured</Text> : null}
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.footerText}>
            {phase === 'capturing' ? 'Hold still for auto-capture' : 'Get ready'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  promptCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(17, 24, 39, 0.74)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  promptStep: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  promptTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  promptHint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  ovalWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oval: {
    width: 230,
    height: 320,
    borderRadius: 115,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ovalFlash: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  countdownText: {
    color: '#fff',
    fontSize: 54,
    fontWeight: '800',
  },
  capturedText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  footer: {
    marginBottom: 6,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: colors.primary,
  },
  footerText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 22,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 22,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  successMark: {
    fontSize: 64,
    color: colors.success,
    fontWeight: '800',
    lineHeight: 70,
  },
  errorMark: {
    fontSize: 64,
    color: colors.error,
    fontWeight: '800',
    lineHeight: 70,
  },
});
