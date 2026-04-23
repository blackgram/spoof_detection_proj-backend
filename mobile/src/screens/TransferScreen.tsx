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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAccountsQuery, useKycStatusQuery, useAccountLookupQuery } from '../query/hooks';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';
import { KYC_AMOUNT_THRESHOLD_NGN, MAX_TRANSFER_AMOUNT_NGN } from '../constants';

const COMMISSION_NGN = 10.75;

const DUMMY_BANKS = [
  { id: '1', name: 'Access Bank' },
  { id: '2', name: 'GTBank' },
  { id: '3', name: 'Zenith Bank' },
  { id: '4', name: 'First Bank' },
  { id: '5', name: 'UBA' },
  { id: '6', name: 'Kuda Microfinance Bank' },
];

function formatAmountWithCommas(raw: string): string {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  const intPart = (parts[0] || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decPart = parts[1] !== undefined ? parts[1].slice(0, 2) : '';
  return decPart ? `${intPart}.${decPart}` : intPart;
}

function parseAmountValue(amountStr: string): number {
  const cleaned = (amountStr || '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'Transfer'>;

export default function TransferScreen() {
  const { kycCompleted, customerId } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const params = route.params as { kycSuccess?: boolean } | undefined;

  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [step, setStep] = useState<'form' | 'kyc_prompt'>('form');
  const [bankDropdownVisible, setBankDropdownVisible] = useState(false);
  const [selectedBank, setSelectedBank] = useState<{ id: string; name: string } | null>(null);
  const [bankTouched, setBankTouched] = useState(false);
  const [accountNumberTouched, setAccountNumberTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);

  const { data: accounts, isPending: balanceLoading, isError: accountsError } =
    useAccountsQuery(customerId);
  const { data: kycStatus, isPending: limitLoading, isError: kycError } = useKycStatusQuery(customerId);
  const { data: lookupResult, isFetching: beneficiaryLookupLoading } = useAccountLookupQuery(
    accountNumber,
    !!selectedBank,
  );

  const firstAccount = accounts?.[0];
  const balance =
    !customerId ? null : accountsError ? null : (firstAccount?.balance_ngn ?? 0);
  const senderAccountNumber = firstAccount?.account_number ?? '';
  const senderAccountType = firstAccount?.account_type ?? 'current';
  const transferLimit = !customerId
    ? null
    : kycError
      ? MAX_TRANSFER_AMOUNT_NGN
      : (kycStatus?.current_limit_ngn ?? MAX_TRANSFER_AMOUNT_NGN);
  const beneficiaryName = lookupResult?.customer_name ?? null;

  const effectiveLimit = transferLimit ?? MAX_TRANSFER_AMOUNT_NGN;
  const amountNum = parseAmountValue(amount);
  const requiresKYC = amountNum >= KYC_AMOUNT_THRESHOLD_NGN;
  const canProceed =
    !!customerId &&
    !!selectedBank &&
    accountNumber.trim().length === 10 &&
    amountNum > 0 &&
    amountNum <= effectiveLimit;

  const handleProceed = () => {
    if (!canProceed || !customerId || !selectedBank) return;
    if (requiresKYC && !kycCompleted) {
      setStep('kyc_prompt');
      return;
    }
    navigation.navigate('Review', {
      senderAccountNumber,
      senderAccountType,
      amount: amountNum,
      beneficiaryAccountNumber: accountNumber.trim(),
      beneficiaryName: beneficiaryName ?? accountNumber.trim(),
      bankName: selectedBank.name,
      narration,
      customerId,
    });
  };

  const handleStartKYC = () => {
    setStep('form');
    navigation.navigate('KYCBvn', { reason: 'transfer' });
  };

  useFocusEffect(
    React.useCallback(() => {
      if (params?.kycSuccess) {
        navigation.setParams({ kycSuccess: false });
      }
    }, [params?.kycSuccess]),
  );

  if (step === 'kyc_prompt') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.kycPromptCard}>
          <Text style={styles.kycTitle}>KYC required</Text>
          <Text style={styles.kycMessage}>
            High-value transfers (₦500,000 and above) require KYC onboarding first.
          </Text>
          <Text style={styles.kycSub}>
            Complete onboarding once; after that you'll authorize high-value transfers with device
            biometrics.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            onPress={handleStartKYC}
          >
            <Text style={styles.primaryButtonText}>Continue to KYC</Text>
          </Pressable>
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
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            
          >
            {/* Account card */}
            <View style={styles.card}>
              <View style={styles.cardAccent} />
              {balanceLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginVertical: 8 }}
                />
              ) : (
                <Text style={styles.balance}>
                  ₦ {(balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </Text>
              )}
              <Text style={styles.accountInfo}>
                {!customerId
                  ? 'Complete KYC to transfer'
                  : `${senderAccountType.toUpperCase()}  ACCOUNT`}
              </Text>
              <Text style={styles.accountStatus}>Account Status: REGULAR</Text>
            </View>

            {/* Limit info */}
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
                <View style={styles.limitBar}>
                  <View style={styles.limitBarFill} />
                </View>
                <View style={styles.limitUsageRow}>
                  <Text style={styles.limitUsageText}>
                    ₦ 0.00 used
                  </Text>
                  <Text style={styles.limitUsageText}>
                    ₦ {effectiveLimit.toLocaleString()} remaining
                  </Text>
                </View>
              </>
            )}

            {/* Form fields */}
            <View style={styles.form}>
              <View style={styles.fieldCard}>
                <Text style={styles.fieldCardLabel}>Bank</Text>
                <Pressable
                  style={[
                    styles.dropdownTrigger,
                    bankTouched && !selectedBank && styles.inputError,
                  ]}
                  onPress={() => setBankDropdownVisible(true)}
                >
                  <Text
                    style={selectedBank ? styles.dropdownText : styles.dropdownPlaceholder}
                  >
                    {selectedBank ? selectedBank.name : 'Select bank'}
                  </Text>
                  <Text style={styles.dropdownChevron}>▼</Text>
                </Pressable>
              </View>
              {bankTouched && !selectedBank && (
                <Text style={styles.fieldError}>Please select a bank to proceed.</Text>
              )}

              <View style={styles.fieldCard}>
                <Text style={styles.fieldCardLabel}>Beneficiary Account Number</Text>
                <TextInput
                  style={[
                    styles.input,
                    accountNumberTouched &&
                      accountNumber.trim().length !== 10 &&
                      styles.inputError,
                  ]}
                  placeholder="Account number"
                  placeholderTextColor={colors.textMuted}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  onBlur={() => {
                    setAccountNumberTouched(true);
                    setBankTouched(true);
                  }}
                  keyboardType="number-pad"
                  maxLength={10}
                />
                {beneficiaryLookupLoading && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={{ alignSelf: 'flex-end', marginTop: -4 }}
                  />
                )}
                {beneficiaryName && !beneficiaryLookupLoading && (
                  <Text style={styles.beneficiaryName}>{beneficiaryName}</Text>
                )}
              </View>
              {accountNumberTouched && accountNumber.trim().length !== 10 && (
                <Text style={styles.fieldError}>Account number must be 10 digits.</Text>
              )}

              <View style={styles.fieldCard}>
                <Text style={styles.fieldCardLabel}>Amount</Text>
                <View style={styles.amountRow}>
                  <Text style={styles.nairaSymbol}>₦</Text>
                  <TextInput
                    style={[
                      styles.amountInput,
                      amountTouched && amountNum > effectiveLimit && styles.inputError,
                    ]}
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
                </View>
              </View>
              {amountTouched && amountNum > 0 && amountNum > effectiveLimit && (
                <Text style={styles.fieldError}>Amount is above transaction limit.</Text>
              )}
              <View style={styles.amountMeta}>
                <Text style={styles.hint}>
                  Maximum Transaction Amount:{' '}
                  <Text style={styles.hintHighlight}>
                    ₦ {effectiveLimit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </Text>
                </Text>
                <Text style={styles.commissionText}>
                  Commission: <Text style={styles.hintHighlight}>₦ {COMMISSION_NGN.toFixed(2)}</Text>
                </Text>
              </View>

              <View style={styles.fieldCard}>
                <Text style={styles.fieldCardLabel}>Narration</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Narration"
                  placeholderTextColor={colors.textMuted}
                  value={narration}
                  onChangeText={setNarration}
                />
              </View>
            </View>

            {/* Proceed button */}
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

      {/* Bank dropdown modal */}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl, flexGrow: 1 },

  /* Account card */
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
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
  },
  balance: { fontSize: 22, fontWeight: '700', color: colors.text },
  accountInfo: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm },
  accountStatus: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  /* Limit */
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  limitText: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm },
  limitBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  limitBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    width: '0%',
  },
  limitUsageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  limitUsageText: { fontSize: 12, color: colors.textMuted },
  limitSub: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },

  /* Form */
  form: { marginBottom: spacing.lg },
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
  fieldCardLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  dropdownText: { fontSize: 16, color: colors.text },
  dropdownPlaceholder: { fontSize: 16, color: colors.textMuted },
  dropdownChevron: { fontSize: 10, color: colors.textMuted },
  input: {
    fontSize: 16,
    color: colors.text,
    paddingVertical: 10,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nairaSymbol: {
    fontSize: 16,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 10,
  },
  amountMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  hint: { fontSize: 11, color: colors.textMuted },
  hintHighlight: { color: colors.primary, fontWeight: '600' },
  commissionText: { fontSize: 11, color: colors.textMuted },
  beneficiaryName: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'right',
    paddingBottom: 6,
  },
  fieldError: {
    fontSize: 13,
    color: colors.error,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  inputError: { borderColor: colors.error },

  /* Buttons */
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonPressed: { opacity: 0.9 },
  primaryButtonDisabled: { backgroundColor: colors.disabled },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backButton: { marginTop: spacing.lg, alignItems: 'center' },
  backButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },

  /* KYC prompt */
  kycPromptCard: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  kycTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  kycMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  kycSub: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg },

  /* Bank dropdown modal */
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
