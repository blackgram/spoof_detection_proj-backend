import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/hooks/use-app-colors';
import { useAuth } from '@/context/AuthContext';
import { parseOtpauthURI } from '@/lib/parseQR';
import { PrimaryButton } from '@/components/primary-button';

export default function ScanScreen() {
  const c = useAppColors();
  const router = useRouter();
  const { setupToken, isTokenSetup } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const payload = parseOtpauthURI(data);

      if (isTokenSetup) {
        Alert.alert(
          'Replace existing token?',
          'You already have a token set up. Scanning this QR will replace it.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
            {
              text: 'Replace',
              style: 'destructive',
              onPress: () => finishSetup(payload),
            },
          ],
        );
        return;
      }

      await finishSetup(payload);
    } catch (e: any) {
      Alert.alert('Invalid QR Code', e.message || 'Could not read this QR code.', [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
    }
  };

  const finishSetup = async (payload: ReturnType<typeof parseOtpauthURI>) => {
    await setupToken({
      username: payload.username,
      issuer: payload.issuer,
      label: payload.label,
      secret: payload.secret,
    });
    router.back();
  };

  if (!permission?.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <Ionicons name="camera-outline" size={64} color={c.textMuted} />
        <Text style={[styles.message, { color: c.text }]}>Camera permission required</Text>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          We need camera access to scan QR codes for token setup.
        </Text>
        <PrimaryButton label="Grant Permission" onPress={requestPermission} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      {/* Overlay */}
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <Ionicons
            name="close"
            size={28}
            color="#fff"
            onPress={() => router.back()}
          />
          <Text style={styles.topTitle}>Scan QR Code</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.reticle} />
        <Text style={styles.hint}>
          Point your camera at the QR code provided by your banking channel.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  message: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 60,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  topTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  reticle: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 24,
  },
  hint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
});
