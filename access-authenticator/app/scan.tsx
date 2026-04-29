import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { activateTotp, type ChannelCode } from '@/api/totpActivation';
import { useAppColors } from '@/hooks/use-app-colors';
import { useAuth } from '@/context/AuthContext';
import { parseActivationQR } from '@/lib/parseActivationQR';
import { PrimaryButton } from '@/components/primary-button';
import { palette } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

/** Corner bracket rendered in SVG-style using nested Views */
function ScanFrame() {
  const primary = palette.light.primary;
  const CORNER = 22;
  const THICK = 3;
  const FRAME = 240;
  const corner = { color: primary, size: CORNER, thick: THICK };

  return (
    <View style={{ width: FRAME, height: FRAME }}>
      {/* dim fill inside frame */}
      <View style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />

      {/* Top-left */}
      <View style={[styles.cTL, { borderColor: corner.color, borderTopWidth: corner.thick, borderLeftWidth: corner.thick, width: corner.size, height: corner.size }]} />
      {/* Top-right */}
      <View style={[styles.cTR, { borderColor: corner.color, borderTopWidth: corner.thick, borderRightWidth: corner.thick, width: corner.size, height: corner.size }]} />
      {/* Bottom-left */}
      <View style={[styles.cBL, { borderColor: corner.color, borderBottomWidth: corner.thick, borderLeftWidth: corner.thick, width: corner.size, height: corner.size }]} />
      {/* Bottom-right */}
      <View style={[styles.cBR, { borderColor: corner.color, borderBottomWidth: corner.thick, borderRightWidth: corner.thick, width: corner.size, height: corner.size }]} />
    </View>
  );
}

export default function ScanScreen() {
  const c = useAppColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setupToken } = useAuth();
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanStatus, setScanStatus] = useState<'scanning' | 'success' | 'activating'>('scanning');
  const [pendingPayload, setPendingPayload] = useState<{
    channelUsername: string;
    channel: ChannelCode;
    activationCode: string;
  } | null>(null);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  const isScanning = scanStatus === 'scanning';
  const scanSubtitle = useMemo(() => {
    if (!pendingPayload) return t('scan.detectedDefault');
    return t('scan.detected', { channel: pendingPayload.channel });
  }, [pendingPayload, t]);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!isScanning) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isScanning, scanLineAnim]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!isScanning) return;
    try {
      const parsed = parseActivationQR(data);
      if (!parsed.activationCode || !parsed.channel || !parsed.channelUsername) {
        const codeOnly = parsed.activationCode ?? '';
        Alert.alert(
          t('scan.incompleteTitle'),
          t('scan.incompleteMessage'),
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => setScanStatus('scanning') },
            {
              text: t('scan.enterManually'),
              onPress: () => {
                router.replace({
                  pathname: '/manual-setup',
                  params: codeOnly ? { code: codeOnly } : {},
                });
              },
            },
          ],
        );
        return;
      }
      setPendingPayload({
        channelUsername: parsed.channelUsername,
        channel: parsed.channel,
        activationCode: parsed.activationCode,
      });
      setScanStatus('success');
    } catch (e: any) {
      Alert.alert(t('scan.invalidTitle'), e.message || t('scan.invalidDefault'), [
        { text: t('common.ok'), onPress: () => setScanStatus('scanning') },
      ]);
    }
  };

  const finishSetup = async (payload: {
    channelUsername: string;
    channel: ChannelCode;
    activationCode: string;
  }) => {
    setScanStatus('activating');
    try {
      const activated = await activateTotp(payload);
      await setupToken({
        username: activated.keycloakUsername,
        issuer: payload.channel,
        label: `${payload.channelUsername} (${payload.channel})`,
        secret: activated.totpSecret,
        channel: payload.channel,
        channelUsername: payload.channelUsername,
        keycloakUserId: activated.keycloakUserId,
        keycloakUsername: activated.keycloakUsername,
      });
      router.back();
    } catch (e: any) {
      setScanStatus('success');
      Alert.alert(t('scan.failedTitle'), e.message || t('scan.failedDefault'));
    }
  };

  /* ── Permission denied ───────────────────────────────── */
  if (!permission?.granted) {
    return (
      <SafeAreaView style={[styles.permContainer, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <View style={[styles.permIconWrap, { backgroundColor: c.accent }]}>
          <Ionicons name="camera-outline" size={40} color={c.primary} />
        </View>
        <Text style={[styles.permTitle, { color: c.text }]}>{t('scan.permTitle')}</Text>
        <Text style={[styles.permSub, { color: c.textMuted }]}>
          {t('scan.permSubtitle')}
        </Text>
        <View style={styles.permBtn}>
          <PrimaryButton label={t('scan.grantPermission')} onPress={requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  /* ── Scanner ─────────────────────────────────────────── */
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
      />

      <SafeAreaView style={styles.uiLayer} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 10) }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t('scan.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Frame in the center */}
        <View style={styles.frameArea}>
          {isScanning ? (
            <>
              <ScanFrame />
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [-120, 120] }) }] },
                ]}
              />
            </>
          ) : (
            <View style={styles.successWrap}>
              <View style={styles.successOuter}>
                <View style={styles.successInner}>
                  <Ionicons name="checkmark" size={36} color="#fff" />
                </View>
              </View>
              <Text style={styles.successTitle}>{t('scan.success')}</Text>
              <Text style={styles.successSubtitle}>{scanSubtitle}</Text>
              <PrimaryButton
                label={scanStatus === 'activating' ? t('scan.activating') : t('scan.activate')}
                onPress={() => pendingPayload && finishSetup(pendingPayload)}
                disabled={scanStatus === 'activating'}
              />
            </View>
          )}
        </View>

        {/* Hint */}
        <View style={styles.hintArea}>
          {isScanning ? (
            <>
              <Text style={styles.hint}>
                {t('scan.point')}
              </Text>
              <View style={styles.dotsRow}>
                <View style={styles.dot} />
                <View style={styles.dot} />
                <View style={styles.dot} />
              </View>
              <TouchableOpacity
                style={styles.manualBtn}
                onPress={() => router.push('/manual-setup')}
                activeOpacity={0.8}
              >
                <Ionicons name="keypad-outline" size={16} color={palette.light.primary} />
                <Text style={[styles.manualBtnText, { color: palette.light.primary }]}>
                  {t('scan.enterManually')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.warningText}>
              {t('scan.warning')}
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const FRAME_SIZE = 240;
const styles = StyleSheet.create({
  /* Permission screen */
  permContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  permSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  permBtn: { width: '100%', marginTop: 8 },

  /* Camera */
  cameraContainer: { flex: 1, backgroundColor: '#000' },

  uiLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },

  frameArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannedBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute',
    width: FRAME_SIZE - 20,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#0B5FCC',
  },
  successWrap: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 8,
  },
  successOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2,
  },
  successSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },

  hintArea: {
    paddingHorizontal: 32,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 14,
  },
  hint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  manualBtnText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#0B5FCC',
  },
  warningText: {
    color: '#FDE68A',
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },

  /* Corner brackets */
  cTL: { position: 'absolute', top: 0, left: 0, borderTopLeftRadius: 8 },
  cTR: { position: 'absolute', top: 0, right: 0, borderTopRightRadius: 8 },
  cBL: { position: 'absolute', bottom: 0, left: 0, borderBottomLeftRadius: 8 },
  cBR: { position: 'absolute', bottom: 0, right: 0, borderBottomRightRadius: 8 },
});
