import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../context/AuthContext';
import { getKycStatus } from '../api/kyc';
import {
  getTransactionChallenge,
  verifyTransaction,
} from '../api/deviceAuth';
import { signChallengeAfterBiometrics } from '../lib/deviceKey';
import { getAccounts, transfer, type TransferAuditPayload } from '../api/transactions';
import { colors, radius, spacing } from '../theme';
import { KYC_AMOUNT_THRESHOLD_NGN, MAX_TRANSFER_AMOUNT_NGN } from '../constants';

const DUMMY_BANKS = [
  { id: '1', name: 'Access Bank' },
  { id: '2', name: 'GTBank' },
  { id: '3', name: 'Zenith Bank' },
  { id: '4', name: 'First Bank' },
  { id: '5', name: 'UBA' },
];

/** Format amount string with thousand separators (e.g. 1000000.50 -> "1,000,000.50") */
function formatAmountWithCommas(raw: string): string {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  const intPart = (parts[0] || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decPart = parts[1] !== undefined ? parts[1].slice(0, 2) : '';
  return decPart ? `${intPart}.${decPart}` : intPart;
}

/** Parse amount string (with commas) to number */
function parseAmountValue(amountStr: string): number {
  const cleaned = (amountStr || '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'Transfer'>;

function buildAuditPayload(
  userId: string,
  deviceId: string,
  biometricModality: 'FACE' | 'FINGER'
): TransferAuditPayload {
  const ts = Date.now();
  return {
    user_id: userId,
    device_id: deviceId,
    public_key_id: 'poc',
    nonce: `n-${ts}`,
    transaction_hash: `h-${ts}`,
    digital_signature: 's-poc',
    biometric_modality: biometricModality,
  };
}

export default function TransferScreen() {
  const { kycCompleted, customerId, user, getDeviceId } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const params = route.params as { kycSuccess?: boolean } | undefined;
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [step, setStep] = useState<'form' | 'confirm' | 'auth' | 'kyc_prompt'>('form');
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [bankDropdownVisible, setBankDropdownVisible] = useState(false);
  const [selectedBank, setSelectedBank] = useState<{ id: string; name: string } | null>(null);
  const [transferLimit, setTransferLimit] = useState<number | null>(null);
  const [limitLoading, setLimitLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [bankTouched, setBankTouched] = useState(false);
  const [accountNumberTouched, setAccountNumberTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);

  const loadTransferLimit = useCallback(async () => {
    if (!customerId) {
      setTransferLimit(null);
      return;
    }
    setLimitLoading(true);
    try {
      const status = await getKycStatus(customerId);
      setTransferLimit(status.current_limit_ngn ?? MAX_TRANSFER_AMOUNT_NGN);
    } catch {
      setTransferLimit(MAX_TRANSFER_AMOUNT_NGN);
    } finally {
      setLimitLoading(false);
    }
  }, [customerId]);

  const loadBalance = useCallback(async () => {
    if (!customerId) {
      setBalance(null);
      return;
    }
    setBalanceLoading(true);
    try {
      const accounts = await getAccounts(customerId);
      const first = accounts[0];
      setBalance(first ? first.balance_ngn : 0);
    } catch {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      loadTransferLimit();
      loadBalance();
    }, [loadTransferLimit, loadBalance])
  );

  const effectiveLimit = transferLimit ?? MAX_TRANSFER_AMOUNT_NGN;
  const amountNum = parseAmountValue(amount);
  const requiresKYC = amountNum >= KYC_AMOUNT_THRESHOLD_NGN;
  const canProceed =
    !!customerId &&
    !!selectedBank &&
    accountNumber.trim().length > 0 &&
    amountNum > 0 &&
    amountNum <= effectiveLimit;

  const handleProceed = () => {
    if (!canProceed) return;
    // High-value (≥ threshold): require device biometrics only. Show KYC prompt only if user hasn't completed onboarding.
    if (requiresKYC && !kycCompleted) {
      setStep('kyc_prompt');
    } else {
      setStep('auth');
    }
  };

  const handleAuthWithPasskey = async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      console.log('[Transfer] handleAuthWithPasskey: step 1 → getTransactionChallenge', { customerId, amountNum, account: accountNumber.trim() });
      const { state_id, challenge: txChallenge } = await getTransactionChallenge(
        customerId,
        amountNum,
        accountNumber.trim()
      );
      console.log('[Transfer] handleAuthWithPasskey: step 2 → sign (biometric prompt) state_id=', state_id);
      const signature = await signChallengeAfterBiometrics(txChallenge);
      console.log('[Transfer] handleAuthWithPasskey: step 3 → verifyTransaction');
      const { getDeviceName } = await import('../lib/deviceInfo');
      const deviceName = getDeviceName();
      await verifyTransaction(state_id, signature, deviceName);
      console.log('[Transfer] handleAuthWithPasskey: step 4 → transfer with state_id');
      await transfer({
        sender_customer_id: customerId,
        beneficiary_account_number: accountNumber.trim(),
        amount_ngn: amountNum,
        audit: buildAuditPayload(user?.userId ?? customerId, getDeviceId(), 'FACE'),
        state_id,
      });
      console.log('[Transfer] handleAuthWithPasskey: step 5 → done, success');
      setSuccessModalVisible(true);
      setStep('form');
      setSelectedBank(null);
      setAccountNumber('');
      setAmount('');
      setNarration('');
      loadBalance();
    } catch (e) {
      console.log('[Transfer] handleAuthWithPasskey: failed', e instanceof Error ? e.message : e);
      Alert.alert('Transfer failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthForLowValue = async (useBiometric: boolean) => {
    if (!customerId) return;
    setLoading(true);
    try {
      if (useBiometric) {
        const { success } = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to complete transfer',
          fallbackLabel: 'Use PIN',
        });
        if (!success) {
          setLoading(false);
          return;
        }
      } else {
        await new Promise((r) => setTimeout(r, 300));
      }
      await transfer({
        sender_customer_id: customerId,
        beneficiary_account_number: accountNumber.trim(),
        amount_ngn: amountNum,
        audit: buildAuditPayload(
          user?.userId ?? customerId,
          getDeviceId(),
          useBiometric ? 'FINGER' : 'FACE'
        ),
      });
      setSuccessModalVisible(true);
      setStep('form');
      setSelectedBank(null);
      setAccountNumber('');
      setAmount('');
      setNarration('');
      loadBalance();
    } catch (e) {
      Alert.alert('Transfer failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartKYC = () => {
    setStep('form');
    // Only shown when !kycCompleted (high-value + not onboarded). Limit increase still uses KYC flow.
    navigation.navigate('KYCBvn', { reason: 'transfer' });
  };

  useFocusEffect(
    React.useCallback(() => {
      if (params?.kycSuccess) {
        setSuccessModalVisible(true);
        navigation.setParams({ kycSuccess: false });
      }
    }, [params?.kycSuccess])
  );

  const closeSuccessModal = () => {
    setSuccessModalVisible(false);
  };

  if (step === 'kyc_prompt') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.kycPromptCard}>
          <Text style={styles.kycTitle}>KYC required</Text>
          <Text style={styles.kycMessage}>
            High-value transfers (₦500,000 and above) require KYC onboarding first.
          </Text>
          <Text style={styles.kycSub}>
            Complete onboarding once; after that you’ll authorize high-value transfers with device biometrics.
          </Text>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]} onPress={handleStartKYC}>
            <Text style={styles.primaryButtonText}>Continue to KYC</Text>
          </Pressable>
          <Pressable style={styles.backButton} onPress={() => setStep('form')}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'auth') {
    const highValueTransfer = requiresKYC;
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.kycPromptCard}>
          <Text style={styles.kycTitle}>Confirm transfer</Text>
          <Text style={styles.kycMessage}>
            Amount: ₦ {amountNum.toLocaleString()} to {accountNumber}
          </Text>
          <Text style={styles.authHint}>
            {highValueTransfer
              ? 'High-value transfer: authorize with device biometrics (Face ID or fingerprint).'
              : 'Authorize with biometrics or fallback to PIN.'}
          </Text>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 16 }} />
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                onPress={handleAuthWithPasskey}
              >
                <Text style={styles.primaryButtonText}>Confirm with Biometrics</Text>
              </Pressable>
              {!highValueTransfer && (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.primaryButtonPressed]}
                    onPress={() => handleAuthForLowValue(true)}
                  >
                    <Text style={styles.secondaryButtonText}>Use biometrics (fallback)</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.primaryButtonPressed]}
                    onPress={() => handleAuthForLowValue(false)}
                  >
                    <Text style={styles.secondaryButtonText}>Use PIN (fallback)</Text>
                  </Pressable>
                </>
              )}
            </>
          )}
          <Pressable style={styles.backButton} onPress={() => setStep('form')}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            <View style={styles.card}>
              <View style={styles.cardAccent} />
              <Text style={styles.balanceLabel}>Current Balance</Text>
              {balanceLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
              ) : (
                <Text style={styles.balance}>
                  ₦ {(balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </Text>
              )}
              <Text style={styles.accountInfo}>
                {!customerId ? 'Complete KYC to transfer' : 'CURRENT ACCOUNT • REGULAR'}
              </Text>
            </View>

            {limitLoading ? (
              <View style={styles.limitRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.limitSub}>Loading your limit…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.limitText}>
                  Daily Transaction Limit: ₦ {effectiveLimit.toLocaleString()}
                </Text>
                <Text style={styles.limitSub}>₦ 0.00 used • ₦ {effectiveLimit.toLocaleString()} remaining</Text>
              </>
            )}

            <View style={styles.form}>
              <Text style={styles.label}>Bank</Text>
              <Pressable
                style={[styles.dropdownTrigger, bankTouched && !selectedBank && styles.inputError]}
                onPress={() => setBankDropdownVisible(true)}
              >
                <Text style={selectedBank ? styles.dropdownText : styles.dropdownPlaceholder}>
                  {selectedBank ? selectedBank.name : 'Select bank'}
                </Text>
                <Text style={styles.dropdownChevron}>▼</Text>
              </Pressable>
              {bankTouched && !selectedBank && (
                <Text style={styles.fieldError}>Please select a bank to proceed.</Text>
              )}

              <Text style={styles.label}>Beneficiary Account Number</Text>
              <TextInput
                style={[styles.input, accountNumberTouched && accountNumber.trim().length !== 10 && styles.inputError]}
                placeholder="Account number"
                placeholderTextColor={colors.textMuted}
                value={accountNumber}
                onChangeText={setAccountNumber}
                onBlur={() => {
                  setAccountNumberTouched(true);
                  setBankTouched(true);
                }}
                keyboardType="number-pad"
              />
              {accountNumberTouched && accountNumber.trim().length !== 10 && (
                <Text style={styles.fieldError}>Account number must be 10 digits.</Text>
              )}

              <Text style={styles.label}>₦ Amount</Text>
              <TextInput
                style={[styles.input, amountTouched && amountNum > effectiveLimit && styles.inputError]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={amount}
                onChangeText={(text) => setAmount(formatAmountWithCommas(text))}
                onBlur={() => {
                  setAmountTouched(true);
                  setBankTouched(true);
                }}
                keyboardType="decimal-pad"
              />
              {amountTouched && amountNum > 0 && amountNum > effectiveLimit && (
                <Text style={styles.fieldError}>Amount is above transaction limit.</Text>
              )}
              <Text style={styles.hint}>
                Maximum: ₦ {effectiveLimit.toLocaleString()}. Amounts ≥ ₦500,000 require biometric authorization.
              </Text>
              <Text style={styles.label}>Narration</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional"
                placeholderTextColor={colors.textMuted}
                value={narration}
                onChangeText={setNarration}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                !canProceed && styles.primaryButtonDisabled,
                pressed && canProceed && styles.primaryButtonPressed,
              ]}
              onPress={handleProceed}
              disabled={!canProceed}
            >
              <Text style={styles.primaryButtonText}>PROCEED</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={bankDropdownVisible} transparent animationType="fade">
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => {
            setBankTouched(true);
            setBankDropdownVisible(false);
          }}
        >
          <View style={styles.dropdownCard}>
            <Text style={styles.dropdownTitle}>Select bank</Text>
            <FlatList
              data={DUMMY_BANKS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
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
              onPress={() => {
                setBankTouched(true);
                setBankDropdownVisible(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={successModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={closeSuccessModal}>
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Transfer successful</Text>
            <Text style={styles.successMessage}>Your transfer has been completed.</Text>
            <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]} onPress={closeSuccessModal}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  balanceLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  balance: { fontSize: 22, fontWeight: '700', color: colors.text },
  accountInfo: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
  },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  limitText: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  limitSub: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },
  form: { marginBottom: spacing.lg },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdownText: { fontSize: 16, color: colors.text },
  dropdownPlaceholder: { fontSize: 16, color: colors.textMuted },
  dropdownChevron: { fontSize: 10, color: colors.textMuted },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    padding: 0,
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
  dropdownTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
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
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
  fieldError: {
    fontSize: 13,
    color: colors.error,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  inputError: { borderColor: colors.error },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonPressed: { opacity: 0.9 },
  primaryButtonDisabled: { backgroundColor: colors.disabled },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    marginTop: spacing.sm,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  backButton: { marginTop: spacing.lg, alignItems: 'center' },
  backButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  kycPromptCard: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  kycTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  kycMessage: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.sm },
  kycSub: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg },
  authHint: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  successCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl - 4,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  successTitle: { fontSize: 20, fontWeight: '700', color: colors.success, marginBottom: spacing.sm, textAlign: 'center' },
  successMessage: { fontSize: 15, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
});
