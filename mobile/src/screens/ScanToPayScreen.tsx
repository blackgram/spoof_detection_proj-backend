import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { BANKS, type Bank } from '../constants/banks';
import { runOcr } from '../features/scanToPay/runOcr';
import {
  parsePaymentDetails,
  parseMultiplePaymentDetails,
  type ParsedAccountEntry,
} from '../features/scanToPay/parsePaymentDetails';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ScanToPay'>;
type Step = 'idle' | 'capturing' | 'processing' | 'select' | 'review' | 'error';

function ModalShell({
  title,
  onClose,
  children,
  scrollable = true,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>
        {scrollable ? (
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={styles.sheetBody}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

export default function ScanToPayScreen() {
  const navigation = useNavigation<Nav>();
  const [step, setStep] = useState<Step>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [detectedBankName, setDetectedBankName] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [lowConfidence, setLowConfidence] = useState(false);
  const [bankDropdownVisible, setBankDropdownVisible] = useState(false);
  const [detectedEntries, setDetectedEntries] = useState<ParsedAccountEntry[]>([]);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const handleClose = () => navigation.goBack();

  const processImage = useCallback(async (uri: string) => {
    setImageUri(uri);
    setStep('processing');
    setErrorMessage(null);
    try {
      const text = await runOcr(uri);
      if (!text) {
        setStep('error');
        setErrorMessage(
          'No text found in the image. Try a clearer photo with the account number and bank name visible.',
        );
        return;
      }
      const multi = parseMultiplePaymentDetails(text);
      console.log('Parsed multiple payment details:', multi);
      setRawText(multi.rawText);

      if (multi.entries.length > 1) {
        // Multiple accounts detected — show selection list
        setDetectedEntries(multi.entries);
        setLowConfidence(multi.confidence === 'low');
        setStep('select');
      } else if (multi.entries.length === 1) {
        // Single account — go straight to review
        const entry = multi.entries[0];
        setSelectedBank(entry.bank);
        setDetectedBankName(entry.detectedBankName);
        setAccountNumber(entry.accountNumber);
        setLowConfidence(
          multi.confidence === 'low' || !entry.bank,
        );
        setStep('review');
      } else {
        // No accounts found — fallback to legacy single parser
        const parsed = parsePaymentDetails(text);
        setRawText(parsed.rawText);
        setSelectedBank(parsed.bank);
        setDetectedBankName(parsed.detectedBankName);
        setAccountNumber(parsed.accountNumber ?? '');
        setLowConfidence(
          parsed.confidence === 'low' || !parsed.bank || !parsed.accountNumber,
        );
        setStep('review');
      }
    } catch (err) {
      console.error('OCR error:', err);
      setStep('error');
      setErrorMessage(
        'Could not read the image. Rebuild the app after installing ML Kit, then try again.',
      );
    }
  }, []);

  const handleTakePhoto = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Camera permission required',
          'Allow camera access to scan payment details.',
        );
        return;
      }
    }
    setStep('capturing');
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        base64: false,
      });
      if (photo?.uri) {
        await processImage(photo.uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
      setStep('idle');
    }
  };

  const handleUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Allow photo library access to upload an image.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await processImage(result.assets[0].uri);
    }
  };

  const handleRetry = () => {
    setImageUri(null);
    setRawText('');
    setSelectedBank(null);
    setDetectedBankName(null);
    setAccountNumber('');
    setLowConfidence(false);
    setErrorMessage(null);
    setDetectedEntries([]);
    setStep('idle');
  };

  const canConfirm = !!selectedBank && accountNumber.trim().length === 10;

  const handleConfirm = () => {
    if (!canConfirm || !selectedBank) return;

    const scanPrefill = {
      bankId: selectedBank.id,
      bankName: selectedBank.name,
      accountNumber: accountNumber.trim(),
    };

    const state = navigation.getState();
    const transferIsBelow = state.routes.some(
      (route, index) => route.name === 'Transfer' && index < state.index,
    );

    if (transferIsBelow) {
      // Opened from Transfer: pop back to it with merged prefill (do not goBack after — that leaves Transfer).
      navigation.navigate({
        name: 'Transfer',
        params: { scanPrefill },
        merge: true,
      });
    } else {
      // Opened from Home: replace ScanToPay with Transfer so back goes to Home.
      navigation.replace('Transfer', { scanPrefill });
    }
  };

  const bankDropdownModal = (
    <Modal visible={bankDropdownVisible} transparent animationType="fade">
      <Pressable
        style={styles.dropdownOverlay}
        onPress={() => setBankDropdownVisible(false)}
      >
        <View style={styles.dropdownCard}>
          <Text style={styles.dropdownTitle}>Select bank</Text>
          <FlatList
            data={BANKS}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.dropdownItem,
                  pressed && styles.dropdownItemPressed,
                ]}
                onPress={() => {
                  setSelectedBank(item);
                  setBankDropdownVisible(false);
                }}
              >
                <Text style={styles.dropdownItemText}>{item.name}</Text>
              </Pressable>
            )}
          />
          <Pressable
            style={styles.dropdownCancel}
            onPress={() => setBankDropdownVisible(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );

  if (step === 'capturing') {
    return (
      <View style={styles.captureModal}>
        <Pressable style={styles.backdrop} onPress={() => setStep('idle')} />
        <View style={styles.captureRoot}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back">
            <SafeAreaView style={styles.captureOverlay} edges={['top', 'bottom']}>
              <Text style={styles.captureHint}>
                Position the account number and bank name inside the frame
              </Text>
              <View style={styles.frameGuide} />
              <View style={styles.captureActions}>
                <Pressable
                  style={({ pressed }) => [styles.captureCancel, pressed && styles.pressed]}
                  onPress={() => setStep('idle')}
                >
                  <Text style={styles.captureCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.captureButton, pressed && styles.pressed]}
                  onPress={handleCapture}
                >
                  <View style={styles.captureButtonInner} />
                </Pressable>
              </View>
            </SafeAreaView>
          </CameraView>
        </View>
      </View>
    );
  }

  if (step === 'processing') {
    return (
      <ModalShell title="Scan to pay" onClose={handleClose} scrollable={false}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.processingText}>Reading account details…</Text>
        </View>
      </ModalShell>
    );
  }

  if (step === 'error') {
    return (
      <ModalShell title="Scan to pay" onClose={handleClose}>
        <Text style={styles.errorTitle}>Could not read details</Text>
        <Text style={styles.errorMessage}>{errorMessage}</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={handleTakePhoto}
        >
          <Text style={styles.primaryButtonText}>Take photo</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={handleUpload}
        >
          <Text style={styles.secondaryButtonText}>Upload image</Text>
        </Pressable>
        <Pressable style={styles.textButton} onPress={handleRetry}>
          <Text style={styles.textButtonText}>Start over</Text>
        </Pressable>
      </ModalShell>
    );
  }

  if (step === 'select') {
    return (
      <ModalShell title="Select account" onClose={handleClose}>
        <Text style={styles.subtitle}>
          Multiple accounts detected. Tap one to continue.
        </Text>

        {lowConfidence && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Some details could not be detected reliably. You can edit after selecting.
            </Text>
          </View>
        )}

        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="cover" />
        )}

        <ScrollView style={styles.entriesList} nestedScrollEnabled>
          {detectedEntries.map((entry, index) => (
            <Pressable
              key={`${entry.accountNumber}-${index}`}
              style={({ pressed }) => [
                styles.entryCard,
                pressed && styles.entryCardPressed,
              ]}
              onPress={() => {
                setSelectedBank(entry.bank);
                setDetectedBankName(entry.detectedBankName);
                setAccountNumber(entry.accountNumber);
                setLowConfidence(!entry.bank);
                setStep('review');
              }}
            >
              <Text style={styles.entryBank}>
                {entry.bank?.name ?? entry.detectedBankName ?? 'Unknown bank'}
              </Text>
              <Text style={styles.entryAccount}>{entry.accountNumber}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable style={styles.textButton} onPress={handleRetry}>
          <Text style={styles.textButtonText}>Scan again</Text>
        </Pressable>
      </ModalShell>
    );
  }

  if (step === 'review') {
    return (
      <>
        <ModalShell title="Confirm details" onClose={handleClose}>
          <Text style={styles.subtitle}>
            Check the bank and account number before continuing to transfer.
          </Text>

          {lowConfidence && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                Some details could not be detected reliably. Please verify or edit below.
              </Text>
            </View>
          )}

          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="cover" />
          )}

          {!selectedBank && detectedBankName && (
            <View style={styles.detectedHint}>
              <Text style={styles.detectedHintLabel}>Detected bank</Text>
              <Text style={styles.detectedHintValue}>{detectedBankName}</Text>
              <Text style={styles.detectedHintSub}>Select the matching bank below.</Text>
            </View>
          )}

          <View style={styles.fieldCard}>
            <Text style={styles.fieldCardLabel}>Bank</Text>
            <Pressable
              style={styles.dropdownTrigger}
              onPress={() => setBankDropdownVisible(true)}
            >
              <Text style={selectedBank ? styles.dropdownText : styles.dropdownPlaceholder}>
                {selectedBank ? selectedBank.name : 'Select bank'}
              </Text>
              <Text style={styles.dropdownChevron}>▼</Text>
            </Pressable>
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldCardLabel}>Account number</Text>
            <TextInput
              style={styles.input}
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="10-digit account number"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Pressable style={styles.rawToggle} onPress={() => setShowRawText((v) => !v)}>
            <Text style={styles.rawToggleText}>
              {showRawText ? 'Hide' : 'Show'} raw detected text
            </Text>
          </Pressable>
          {showRawText && <Text style={styles.rawText}>{rawText || '(empty)'}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              !canConfirm && styles.primaryButtonDisabled,
              pressed && canConfirm && styles.pressed,
            ]}
            onPress={handleConfirm}
            disabled={!canConfirm}
          >
            <Text style={styles.primaryButtonText}>Use these details</Text>
          </Pressable>

          <Pressable style={styles.textButton} onPress={handleRetry}>
            <Text style={styles.textButtonText}>Scan again</Text>
          </Pressable>
        </ModalShell>
        {bankDropdownModal}
      </>
    );
  }

  return (
    <ModalShell title="Scan to pay" onClose={handleClose}>
      <Text style={styles.subtitle}>
        Scan a transfer slip or account label showing the bank name and account number.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        onPress={handleTakePhoto}
      >
        <Text style={styles.primaryButtonText}>Take photo</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        onPress={handleUpload}
      >
        <Text style={styles.secondaryButtonText}>Upload image</Text>
      </Pressable>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeIcon: {
    fontSize: 22,
    color: colors.textMuted,
    fontWeight: '600',
  },
  sheetScroll: { flexGrow: 0 },
  sheetScrollContent: { paddingBottom: spacing.xl },
  sheetBody: { paddingBottom: spacing.xl },
  centered: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  processingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  warningBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  warningText: { fontSize: 14, color: colors.warning, lineHeight: 20 },
  detectedHint: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  detectedHintLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  detectedHintValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  detectedHintSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  thumbnail: {
    width: '100%',
    height: 140,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    backgroundColor: colors.cardBorder,
  },
  fieldCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 4,
    marginBottom: spacing.md,
  },
  fieldCardLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  dropdownText: { fontSize: 16, color: colors.text },
  dropdownPlaceholder: { fontSize: 16, color: colors.textMuted },
  dropdownChevron: { fontSize: 10, color: colors.textMuted },
  input: { fontSize: 16, color: colors.text, paddingVertical: 10 },
  rawToggle: { marginBottom: spacing.sm },
  rawToggleText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  rawText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  entriesList: {
    maxHeight: 280,
    marginBottom: spacing.md,
  },
  entryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  entryCardPressed: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  entryBank: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  entryAccount: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonDisabled: { backgroundColor: colors.disabled },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.sm,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  textButton: { alignItems: 'center', paddingVertical: spacing.md },
  textButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.9 },
  captureModal: { flex: 1 },
  captureRoot: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  camera: { flex: 1 },
  captureOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  captureHint: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  frameGuide: {
    alignSelf: 'center',
    width: '90%',
    aspectRatio: 1.4,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  captureActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  captureCancel: { padding: spacing.md },
  captureCancelText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  dropdownCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 10,
    maxHeight: '50%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  dropdownItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemPressed: { backgroundColor: colors.primaryMuted },
  dropdownItemText: { fontSize: 16, color: colors.text },
  dropdownCancel: { marginTop: spacing.sm, alignItems: 'center', paddingVertical: spacing.sm },
  cancelButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
