import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, Mask, Rect as SvgRect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Camera } from 'react-native-vision-camera';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Camera as FaceCamera } from 'react-native-vision-camera-face-detector';
import type { Face } from 'react-native-vision-camera-face-detector';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { KycReason } from '../navigation/AppNavigator';
import {
  KycApiError,
  kycLivenessStart,
  kycLivenessVerify,
  type LivenessPrompt,
  type LivenessStartResponse,
  type MultiCaptureVerificationResult,
} from '../api/kyc';
import { useAuth } from '../context/AuthContext';
import { useLivenessGatekeeper } from '../features/liveness/useLivenessGatekeeper';
import { colors } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'KYCLivenessMulti'>;

type ScreenPhase = 'intro' | 'loading' | 'instruction' | 'capturing' | 'flash' | 'submitting' | 'success' | 'error';
type RingState = 'neutral' | 'warning' | 'success';

const PROMPT_LABELS: Record<LivenessPrompt, string> = {
  look_straight: 'Look straight at the camera',
  turn_left: 'Turn your head to the left',
  turn_right: 'Turn your head to the right',
  smile: 'Smile naturally',
  blink: 'Blink naturally',
  nod: 'Nod your head gently',
};

const PROMPT_ICONS: Record<LivenessPrompt, string> = {
  look_straight: '👤',
  turn_left: '👈',
  turn_right: '👉',
  smile: '😊',
  blink: '😑',
  nod: '🙂',
};

/** Must match ring / mask geometry (230×320 capsule, rx = half width). */
const OVAL_GUIDE_W = 230;
const OVAL_GUIDE_H = 320;
const OVAL_GUIDE_RX = 115;
const OVAL_CUTOUT_MASK_ID = 'kycLivenessOvalCutout';

function startSessionErrorMessage(e: unknown): string {
  if (e instanceof KycApiError) {
    if (e.status === 404) return 'Customer not found. Please restart registration.';
    return e.message;
  }
  return e instanceof Error ? e.message : 'Failed to start liveness check.';
}

function verifyErrorMessage(e: unknown): string {
  if (e instanceof KycApiError) {
    if (e.status === 410) return 'Liveness session expired. Tap Try again to start a new session.';
    return e.message;
  }
  return e instanceof Error ? e.message : 'Liveness verification failed.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Intro Screen Component
// ─────────────────────────────────────────────────────────────────────────────

function IntroScreen({ onBegin, onCancel }: { onBegin: () => void; onCancel: () => void }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.introContent}>
        {/* Icon */}
        <View style={styles.introIconOuter}>
          <View style={styles.introIconInner}>
            <Text style={styles.introIconText}>🔒</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.introTitle}>Face ID Verification</Text>
        <Text style={styles.introSubtitle}>
          We'll scan your face to confirm your identity. This takes just a few seconds.
        </Text>

        {/* Steps Card */}
        <View style={styles.stepsCard}>
          <StepItem
            emoji="👁️"
            title="Position your face"
            description="Center your face in the frame"
          />
          <StepItem
            emoji="📸"
            title="Follow the prompts"
            description="Turn, blink, or smile as instructed"
          />
          <StepItem
            emoji="🛡️"
            title="Verification complete"
            description="Access granted securely"
          />
        </View>

        {/* Privacy Text */}
        <View style={styles.privacyRow}>
          <Text style={styles.privacyIcon}>🔐</Text>
          <Text style={styles.privacyText}>
            Your biometric data is never stored or shared
          </Text>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.introFooter}>
        <Pressable style={styles.beginButton} onPress={onBegin}>
          <Text style={styles.beginButtonText}>Begin Verification</Text>
          <Text style={styles.beginButtonArrow}>›</Text>
        </Pressable>
        <Pressable style={styles.cancelLink} onPress={onCancel}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function StepItem({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <View style={styles.stepItem}>
      <View style={styles.stepIconBox}>
        <Text style={styles.stepEmoji}>{emoji}</Text>
      </View>
      <View style={styles.stepTextWrap}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{description}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function KYCLivenessMultiScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { completeKYCWithCustomerId, setLastUsernameForLogin } = useAuth();
  const params = (route.params ?? {}) as {
    reason: KycReason;
    customerId?: string;
    username?: string;
  };

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const cameraRef = useRef<Camera>(null);

  const [phase, setPhase] = useState<ScreenPhase>('intro');
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionNonce, setSessionNonce] = useState('');
  const [prompts, setPrompts] = useState<LivenessPrompt[]>([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [frames, setFrames] = useState<{ uri: string; capturedAtMs: number }[]>([]);
  const [resultMessage, setResultMessage] = useState('');
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);

  const customerId = params.customerId?.trim() || '';
  const username = params.username?.trim() || '';
  const currentPrompt = prompts[promptIndex];

  const { width: winW, height: winH } = useWindowDimensions();
  const [ovalCutoutCenter, setOvalCutoutCenter] = useState<{ cx: number; cy: number } | null>(null);
  const cutoutCxCy = ovalCutoutCenter ?? { cx: winW / 2, cy: winH / 2 };

  const onOvalWrapLayout = useCallback((e: LayoutChangeEvent) => {
    e.currentTarget.measureInWindow((x, y, width, height) => {
      setOvalCutoutCenter({ cx: x + width / 2, cy: y + height / 2 });
    });
  }, []);

  const gatePhase = useMemo(() => {
    if (phase === 'instruction') return 'instruction' as const;
    if (phase === 'capturing' || phase === 'flash') return 'capturing' as const;
    return 'idle' as const;
  }, [phase]);

  const ovalGuide = useMemo(
    () => ({
      cx: cutoutCxCy.cx,
      cy: cutoutCxCy.cy,
      width: OVAL_GUIDE_W,
      height: OVAL_GUIDE_H,
      edgeInsetPx: 14,
    }),
    [cutoutCxCy.cx, cutoutCxCy.cy]
  );

  // Always enable all classifications (eye open, smile) for blink/smile/straight detection
  const faceDetectionOptions = useMemo(
    () => ({
      performanceMode: 'fast' as const,
      classificationMode: 'all' as const,
      landmarkMode: 'none' as const,
      contourMode: 'none' as const,
      minFaceSize: 0.15,
      trackingEnabled: true,
      autoMode: true,
      windowWidth: winW,
      windowHeight: winH,
      cameraFacing: 'front' as const,
    }),
    [winW, winH]
  );

  const { onFacesDetected, gateHint, instructionReady, instantOk, resetTemporalState } =
    useLivenessGatekeeper({
      prompt: currentPrompt,
      gatePhase,
      oval: ovalGuide,
    });

  const resetChallengeSameSession = useCallback(() => {
    setFrames([]);
    setPromptIndex(0);
    setCountdown(3);
    resetTemporalState();
    setPhase('instruction');
  }, [resetTemporalState]);

  const startNewSession = useCallback(async (): Promise<boolean> => {
    if (!customerId) {
      setErrorMessage('Missing customer id. Please restart registration.');
      setPhase('error');
      return false;
    }
    try {
      setPhase('loading');
      setErrorMessage('');
      const data = await kycLivenessStart(customerId);
      setSessionId(data.session_id);
      setSessionNonce(data.nonce || '');
      setPrompts(data.prompts);
      setPromptIndex(0);
      setFrames([]);
      setCountdown(3);
      setSessionExpiresAt(new Date(data.expires_at).getTime());
      resetTemporalState();
      console.log('[KYCLivenessMulti] session ready', {
        sessionId: data.session_id,
        prompts: data.prompts,
        expires_at: data.expires_at,
      });
      setPhase('instruction');
      return true;
    } catch (e) {
      setErrorMessage(startSessionErrorMessage(e));
      setPhase('error');
      return false;
    }
  }, [customerId, resetTemporalState]);

  const handleFacesDetected = useCallback(
    (faces: Face[]) => {
      onFacesDetected(faces, Date.now());
    },
    [onFacesDetected]
  );

  // Reset temporal state when prompt changes
  useEffect(() => {
    resetTemporalState();
  }, [currentPrompt, promptIndex, resetTemporalState]);

  // Step progress dot colors
  const stepDotColor = useMemo(() => {
    return (index: number): string => {
      if (index < promptIndex) return colors.success;
      if (index > promptIndex) return '#333';
      if (phase === 'instruction') return colors.warning;
      if (phase === 'capturing') return colors.primary;
      if (phase === 'flash') return colors.success;
      return '#333';
    };
  }, [phase, promptIndex]);

  const ringState: RingState = useMemo(() => {
    if (phase === 'flash') return 'success';
    if (phase === 'capturing') return instantOk ? 'success' : 'warning';
    if (phase === 'instruction') return instructionReady ? 'success' : 'warning';
    return 'neutral';
  }, [phase, instantOk, instructionReady]);

  const footerInstruction = useMemo(() => {
    if (phase === 'instruction' && instructionReady) return 'Looks good — hold still';
    if (phase === 'capturing') return gateHint || 'Hold still for auto-capture';
    if (phase === 'instruction' && gateHint) return gateHint;
    if (currentPrompt) return PROMPT_LABELS[currentPrompt];
    return 'Follow the on-screen prompts';
  }, [phase, instructionReady, gateHint, currentPrompt]);

  // Request camera permission on mount
  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Auto-transition from instruction → capturing when ready
  useEffect(() => {
    if (phase !== 'instruction' || !currentPrompt || !instructionReady) return;
    const id = setTimeout(() => {
      setCountdown(3);
      setPhase('capturing');
    }, 450);
    return () => clearTimeout(id);
  }, [phase, currentPrompt, instructionReady]);

  // Countdown during capturing
  useEffect(() => {
    if (phase !== 'capturing') return;
    if (!instantOk) {
      setCountdown(3);
      return;
    }
    const id = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(id);
  }, [phase, instantOk]);

  // Auto-capture when countdown reaches 0
  useEffect(() => {
    if (phase !== 'capturing' || !instantOk || countdown > 0) return;
    let cancelled = false;
    async function autoCapture() {
      try {
        const photo = await cameraRef.current?.takePhoto({ flash: 'off', enableShutterSound: false });
        if (cancelled || !photo?.path) throw new Error('Could not capture frame.');
        const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
        setFrames((prev) => [...prev, { uri, capturedAtMs: Date.now() }]);
        console.log('[KYCLivenessMulti] frame captured', { prompt: currentPrompt, index: promptIndex });
        setPhase('flash');
      } catch (e) {
        if (cancelled) return;
        setErrorMessage(e instanceof Error ? e.message : 'Capture failed. Please retry.');
        setPhase('error');
      }
    }
    autoCapture();
    return () => { cancelled = true; };
  }, [countdown, phase, instantOk, currentPrompt, promptIndex]);

  // After flash, advance to next prompt or submit
  useEffect(() => {
    if (phase !== 'flash') return;
    const id = setTimeout(() => {
      if (promptIndex >= prompts.length - 1) {
        setPhase('submitting');
      } else {
        setPromptIndex((prev) => prev + 1);
        setPhase('instruction');
      }
    }, 500);
    return () => clearTimeout(id);
  }, [phase, promptIndex, prompts.length]);

  // Submit frames for verification
  useEffect(() => {
    if (phase !== 'submitting') return;
    let cancelled = false;
    async function verify() {
      if (!sessionId || !customerId) {
        setErrorMessage('Missing liveness session. Please retry.');
        setPhase('error');
        return;
      }
      if (sessionExpiresAt != null && Date.now() >= sessionExpiresAt) {
        console.log('[KYCLivenessMulti] session expired locally before verify');
        await startNewSession();
        return;
      }
      try {
        const data = await kycLivenessVerify({
          customerId,
          sessionId,
          nonce: sessionNonce,
          frames,
          expectedPromptCount: prompts.length,
        });
        if (cancelled) return;
        if (data.overall_result === 'pass') {
          await completeKYCWithCustomerId(customerId);
          if (username) await setLastUsernameForLogin(username);
          setResultMessage('Liveness passed. Continue to sign in.');
          console.log('[KYCLivenessMulti] verification pass', { sessionId, overall_result: data.overall_result });
          setPhase('success');
          return;
        }
        if (data.overall_result === 'retry') {
          console.log('[KYCLivenessMulti] verification retry', { sessionId, message: data.message });
          resetChallengeSameSession();
          return;
        }
        console.log('[KYCLivenessMulti] verification non-pass', { sessionId, overall_result: data.overall_result });
        setErrorMessage(data.message || 'Verification did not pass. Please retry.');
        setPhase('error');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof KycApiError && e.status === 410) {
          await startNewSession();
          return;
        }
        setErrorMessage(verifyErrorMessage(e));
        setPhase('error');
      }
    }
    verify();
    return () => { cancelled = true; };
  }, [phase, sessionId, customerId, sessionNonce, frames, completeKYCWithCustomerId, setLastUsernameForLogin, username, prompts.length, resetChallengeSameSession, sessionExpiresAt, startNewSession]);

  const onRetry = () => void startNewSession();

  const handleBeginVerification = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    void startNewSession();
  }, [hasPermission, requestPermission, startNewSession]);

  // ─── Render ───

  // Intro phase
  if (phase === 'intro') {
    return <IntroScreen onBegin={handleBeginVerification} onCancel={() => navigation.goBack()} />;
  }

  // Permission not granted
  if (!hasPermission) {
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

  // Loading / Submitting
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

  // Success
  if (phase === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <View style={styles.resultIconWrap}>
            <Text style={styles.successMark}>✓</Text>
          </View>
          <Text style={styles.title}>Verification Complete</Text>
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

  // Error
  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <View style={styles.resultIconWrap}>
            <Text style={styles.errorMark}>✕</Text>
          </View>
          <Text style={styles.title}>Verification Failed</Text>
          <Text style={styles.subtitle}>{errorMessage}</Text>
          <Pressable style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // No camera
  if (device == null) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.subtitle}>No front camera found on this device.</Text>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Camera Capture Phase ───
  return (
    <View style={styles.cameraRoot}>
      <FaceCamera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={phase === 'instruction' || phase === 'capturing' || phase === 'flash'}
        photo
        faceDetectionOptions={faceDetectionOptions}
        faceDetectionCallback={handleFacesDetected}
      />

      {/* Oval mask overlay */}
      <Svg width={winW} height={winH} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id={OVAL_CUTOUT_MASK_ID} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <SvgRect width={winW} height={winH} fill="#ffffff" />
            <SvgRect
              x={cutoutCxCy.cx - OVAL_GUIDE_W / 2}
              y={cutoutCxCy.cy - OVAL_GUIDE_H / 2}
              width={OVAL_GUIDE_W}
              height={OVAL_GUIDE_H}
              rx={OVAL_GUIDE_RX}
              ry={OVAL_GUIDE_RX}
              fill="#000000"
            />
          </Mask>
        </Defs>
        <SvgRect width={winW} height={winH} fill="rgba(0,0,0,0.7)" mask={`url(#${OVAL_CUTOUT_MASK_ID})`} />
      </Svg>

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
          <View style={styles.stepCounter}>
            <Text style={styles.stepCounterText}>
              {Math.min(promptIndex + 1, prompts.length)} / {prompts.length}
            </Text>
          </View>
        </View>

        {/* Prompt card */}
        <View style={styles.promptCard}>
          <Text style={styles.promptEmoji}>{currentPrompt ? PROMPT_ICONS[currentPrompt] : '👤'}</Text>
          <Text style={styles.promptTitle}>
            {currentPrompt ? PROMPT_LABELS[currentPrompt] : 'Follow the prompt'}
          </Text>
        </View>

        {/* Oval area */}
        <View style={styles.ovalWrap} onLayout={onOvalWrapLayout}>
          <View style={[styles.ringGlow, ringState === 'success' && styles.ringGlowSuccess]} />
          <View style={styles.ovalHudPlate}>
            <View style={styles.ovalCameraHud} pointerEvents="none">
              {phase === 'capturing' && <Text style={styles.countdownText}>{countdown}</Text>}
              {phase === 'flash' && <Text style={styles.capturedText}>✓</Text>}
            </View>
          </View>
          <View style={[styles.ovalOuterRing, ringState === 'warning' && styles.ovalOuterRingWarning]} />
          <View
            style={[
              styles.ovalInnerRing,
              ringState === 'success' && styles.ovalInnerRingSuccess,
              ringState === 'warning' && styles.ovalInnerRingWarning,
            ]}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.stepDotsRow}>
            {prompts.map((_, i) => (
              <View
                key={`dot-${i}`}
                style={[
                  styles.stepDot,
                  { backgroundColor: stepDotColor(i) },
                  i === promptIndex && styles.stepDotCurrent,
                ]}
              />
            ))}
          </View>
          <Text style={styles.footerText}>{footerInstruction}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ─── Common ───
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 12, marginBottom: 24, lineHeight: 22 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, width: '100%', maxWidth: 320, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryButton: { marginTop: 10, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24, width: '100%', maxWidth: 320, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontWeight: '600', fontSize: 16 },
  resultIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successMark: { fontSize: 48, color: colors.success, fontWeight: '800' },
  errorMark: { fontSize: 48, color: colors.error, fontWeight: '800' },

  // ─── Intro Screen ───
  introContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  introIconOuter: { alignSelf: 'center', width: 112, height: 112, borderRadius: 56, borderWidth: 1, borderColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  introIconInner: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  introIconText: { fontSize: 34 },
  introTitle: { marginTop: 32, textAlign: 'center', fontSize: 28, fontWeight: '700', color: colors.text },
  introSubtitle: { marginTop: 16, textAlign: 'center', fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  stepsCard: { marginTop: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 20, backgroundColor: colors.card },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  stepIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  stepEmoji: { fontSize: 22 },
  stepTextWrap: { marginLeft: 16, flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  stepDesc: { marginTop: 4, fontSize: 13, color: colors.textMuted },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  privacyIcon: { fontSize: 14 },
  privacyText: { marginLeft: 8, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  introFooter: { paddingHorizontal: 24, paddingBottom: 16 },
  beginButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18 },
  beginButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  beginButtonArrow: { fontSize: 22, fontWeight: '700', color: '#fff', marginLeft: 8 },
  cancelLink: { alignItems: 'center', paddingVertical: 14 },
  cancelLinkText: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },

  // ─── Camera Capture ───
  cameraRoot: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: 'transparent', zIndex: 2 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  closeButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  stepCounter: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
  stepCounterText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  promptCard: { alignSelf: 'center', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  promptEmoji: { fontSize: 28, marginBottom: 8 },
  promptTitle: { color: colors.primary, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  ovalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ovalHudPlate: { width: OVAL_GUIDE_W, height: OVAL_GUIDE_H, borderRadius: OVAL_GUIDE_RX, zIndex: 1, alignItems: 'center', justifyContent: 'center' },
  ovalCameraHud: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringGlow: { position: 'absolute', width: 270, height: 360, borderRadius: 135, backgroundColor: 'rgba(255,255,255,0.04)', zIndex: 0 },
  ringGlowSuccess: { backgroundColor: colors.successMuted },
  ovalOuterRing: { position: 'absolute', width: 250, height: 340, borderRadius: 125, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)', borderStyle: 'dashed', zIndex: 2 },
  ovalOuterRingWarning: { borderColor: colors.warning },
  ovalInnerRing: { position: 'absolute', width: 238, height: 328, borderRadius: 119, borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)', zIndex: 3 },
  ovalInnerRingSuccess: { borderColor: colors.success },
  ovalInnerRingWarning: { borderColor: colors.warning },
  countdownText: { color: '#fff', fontSize: 54, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  capturedText: { color: colors.success, fontSize: 54, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  footer: { marginBottom: 6 },
  stepDotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  stepDotCurrent: { width: 10, height: 10, borderRadius: 5 },
  footerText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },
});
