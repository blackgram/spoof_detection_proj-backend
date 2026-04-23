import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import {
  getTransactionChallenge,
  verifyTransaction,
} from '../api/deviceAuth';
import { signChallengeAfterBiometrics, signChallenge, hasDeviceKey } from '../lib/deviceKey';
import { transfer, type TransferAuditPayload } from '../api/transactions';
import FingerprintIcon from '../components/Icons/FingerprintIcon';
import { colors, radius, spacing } from '../theme';
import { KYC_AMOUNT_THRESHOLD_NGN } from '../constants';
import { queryKeys } from '../query/keys';

const COMMISSION_NGN = 10.75;
const PIN_LENGTH = 4;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<RootStackParamList, 'Review'>;

function buildAuditPayload(
  userId: string,
  deviceId: string,
  biometricModality: 'FACE' | 'FINGER',
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

export default function ReviewScreen() {
  const { customerId, user, getDeviceId, getProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const params = route.params as RootStackParamList['Review'];

  const {
    senderAccountNumber,
    senderAccountType,
    amount,
    beneficiaryAccountNumber,
    beneficiaryName,
    bankName,
    customerId: paramCustomerId,
  } = params;

  const effectiveCustomerId = customerId ?? paramCustomerId;
  const totalDebit = amount + COMMISSION_NGN;
  const isHighValue = amount >= KYC_AMOUNT_THRESHOLD_NGN;

  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingBiometricStateId, setPendingBiometricStateId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.name) return;
    getProfile(user.name).then((p) => {
      setHasBiometrics(!!p?.hasBiometrics);
    });
  }, [user?.name, getProfile]);

  const executeBiometricAndShowPin = useCallback(async () => {
    if (!effectiveCustomerId) return;
    setLoading(true);
    try {
      const { state_id, challenge: txChallenge } = await getTransactionChallenge(
        effectiveCustomerId,
        amount,
        beneficiaryAccountNumber,
      );
      const signature = await signChallengeAfterBiometrics(txChallenge);
      const { getDeviceName } = await import('../lib/deviceInfo');
      const deviceName = getDeviceName();
      await verifyTransaction(state_id, signature, deviceName);
      setPendingBiometricStateId(state_id);
      setPin('');
      setPinModalVisible(true);
    } catch (e) {
      Alert.alert('Transfer failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [effectiveCustomerId, amount, beneficiaryAccountNumber]);

  const finishTransfer = useCallback(async (stateId: string | null, biometricUsed: boolean) => {
    if (!effectiveCustomerId) return;
    setLoading(true);
    setPinModalVisible(false);
    setPin('');
    try {
      if (!stateId) {
        const hasKey = await hasDeviceKey();
        if (hasKey) {
          const { state_id, challenge: txChallenge } = await getTransactionChallenge(
            effectiveCustomerId,
            amount,
            beneficiaryAccountNumber,
          );
          const signature = await signChallenge(txChallenge);
          const { getDeviceName } = await import('../lib/deviceInfo');
          const deviceName = getDeviceName();
          await verifyTransaction(state_id, signature, deviceName);
          stateId = state_id;
        }
      }
      await transfer({
        sender_customer_id: effectiveCustomerId,
        beneficiary_account_number: beneficiaryAccountNumber,
        amount_ngn: amount,
        audit: buildAuditPayload(
          user?.userId ?? effectiveCustomerId,
          getDeviceId(),
          biometricUsed ? 'FACE' : 'FINGER',
        ),
        ...(stateId ? { state_id: stateId } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts(effectiveCustomerId) });
      setPendingBiometricStateId(null);
      setSuccessModalVisible(true);
    } catch (e) {
      Alert.alert('Transfer failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [effectiveCustomerId, amount, beneficiaryAccountNumber, user, getDeviceId, queryClient]);

  const handleTransferPress = () => {
    setPendingBiometricStateId(null);
    setPinModalVisible(true);
    setPin('');
  };

  const handleBiometricPress = () => {
    executeBiometricAndShowPin();
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      const biometricUsed = !!pendingBiometricStateId;
      setTimeout(() => finishTransfer(pendingBiometricStateId, biometricUsed), 200);
    }
  };

  const handlePinBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handlePinBiometric = () => {
    setPinModalVisible(false);
    setPin('');
    executeBiometricAndShowPin();
  };

  const closeSuccessModal = () => {
    setSuccessModalVisible(false);
    navigation.popToTop();
  };

  const padKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

  return (
    <>
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        {/* Transfer flow row */}
        <View style={styles.flowRow}>
          <View style={styles.flowEndpoint}>
            <Text style={styles.flowLabelBlue}>From</Text>
            <Text style={styles.flowAccount}>{senderAccountNumber}</Text>
            <Text style={styles.flowSub}>{senderAccountType.toUpperCase()}</Text>
          </View>

          <View style={styles.flowCenter}>
            <View style={styles.amountBubble}>
              <Text style={styles.flowAmount}>
                ₦ {amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.flowLine}>
              <View style={styles.flowDot} />
              <View style={styles.flowTrack} />
              <View style={styles.flowDot} />
            </View>
          </View>

          <View style={[styles.flowEndpoint, styles.flowEndpointRight]}>
            <Text style={styles.flowLabelBlue}>To</Text>
            <Text style={styles.flowAccount}>{beneficiaryAccountNumber}</Text>
            <Text style={styles.flowSub} numberOfLines={1}>
              {beneficiaryName}
            </Text>
          </View>
        </View>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Bank</Text>
            <Text style={styles.summaryValueBlue}>{bankName}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Commission</Text>
            <Text style={styles.summaryValueBlue}>₦ {COMMISSION_NGN.toFixed(2)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Debit</Text>
            <Text style={styles.summaryValueBlue}>
              ₦ {totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Transfer button area */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginBottom: spacing.xl }}
          />
        ) : (
          <View style={styles.buttonRow}>
            {isHighValue ? (
              <Pressable
                style={({ pressed }) => [
                  styles.transferButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleBiometricPress}
              >
                <View style={styles.biometricTransferRow}>
                  <FingerprintIcon size={22} color="#fff" />
                  <Text style={styles.transferButtonText}>AUTHORIZE WITH BIOMETRICS</Text>
                </View>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.transferButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleTransferPress}
                >
                  <Text style={styles.transferButtonText}>TRANSFER</Text>
                </Pressable>
                {hasBiometrics && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.biometricButtonOuter,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleBiometricPress}
                  >
                    <FingerprintIcon size={24} color="#fff" />
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}
      </SafeAreaView>

      {/* PIN entry bottom sheet */}
      <Modal visible={pinModalVisible} transparent animationType="slide">
        <Pressable
          style={styles.pinOverlay}
          onPress={() => {
            setPinModalVisible(false);
            setPin('');
          }}
        >
          <Pressable
            style={styles.pinSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.pinHeader}>
              <Text style={styles.pinTitle}>Enter Transaction PIN</Text>
              <Pressable
                onPress={() => {
                  setPinModalVisible(false);
                  setPin('');
                }}
              >
                <Text style={styles.pinClose}>✕</Text>
              </Pressable>
            </View>

            {/* PIN dots */}
            <View style={styles.pinDotsRow}>
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.pinDot, i < pin.length && styles.pinDotFilled]}
                />
              ))}
            </View>

            {/* Number pad */}
            <View style={styles.padGrid}>
              {padKeys.map((key) => {
                if (key === 'bio') {
                  return (
                    <Pressable
                      key={key}
                      style={styles.padKey}
                      onPress={handlePinBiometric}
                    >
                      <FingerprintIcon size={28} color={colors.primary} />
                    </Pressable>
                  );
                }
                if (key === 'del') {
                  return (
                    <Pressable
                      key={key}
                      style={styles.padKey}
                      onPress={handlePinBackspace}
                    >
                      <Text style={styles.padKeyDel}>⌫</Text>
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [
                      styles.padKey,
                      pressed && styles.padKeyPressed,
                    ]}
                    onPress={() => handlePinDigit(key)}
                  >
                    <Text style={styles.padKeyText}>{key}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.tokenLink}>
              <Text style={styles.tokenLinkText}>Verify with Token</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Success modal */}
      <Modal visible={successModalVisible} transparent animationType="fade">
        <Pressable style={styles.successOverlay} onPress={closeSuccessModal}>
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Transfer successful</Text>
            <Text style={styles.successMessage}>Your transfer has been completed.</Text>
            <Pressable
              style={({ pressed }) => [styles.doneButton, pressed && styles.buttonPressed]}
              onPress={closeSuccessModal}
            >
              <Text style={styles.transferButtonText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },

  /* ── Transfer flow row ── */
  flowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  flowEndpoint: {
    flex: 1,
  },
  flowEndpointRight: {
    alignItems: 'flex-end',
  },
  flowLabelGreen: {
    fontSize: 11,
    color: colors.success,
    marginBottom: 2,
  },
  flowLabelBlue: {
    fontSize: 11,
    color: '#60a5fa',
    marginBottom: 2,
  },
  flowAccount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  flowSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  flowCenter: {
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    flex: 1.3,
  },
  amountBubble: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  flowAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  flowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  flowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  flowTrack: {
    flex: 1,
    height: 2,
    backgroundColor: colors.textMuted,
  },

  /* ── Summary card ── */
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  summaryLabel: {
    fontSize: 15,
    color: colors.text,
  },
  summaryValueBlue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
  },
  summaryValueGreen: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
  summaryValueOrange: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },

  /* ── Buttons ── */
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  transferButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  biometricTransferRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  transferButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  biometricButtonOuter: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricIconText: {
    fontSize: 24,
  },

  /* ── PIN bottom sheet ── */
  pinOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  pinSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  pinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  pinClose: {
    fontSize: 20,
    color: colors.textMuted,
    padding: spacing.sm,
  },
  pinDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: spacing.xl,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#60a5fa',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: '#60a5fa',
  },

  /* ── Number pad ── */
  padGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  padKey: {
    width: (SCREEN_WIDTH - spacing.lg * 2) / 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  padKeyPressed: {
    opacity: 0.5,
  },
  padKeyText: {
    fontSize: 28,
    fontWeight: '500',
    color: '#60a5fa',
  },
  padKeyBio: {
    fontSize: 28,
  },
  padKeyDel: {
    fontSize: 24,
    color: '#60a5fa',
  },
  tokenLink: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  tokenLinkText: {
    fontSize: 14,
    color: '#60a5fa',
  },

  /* ── Success modal ── */
  successOverlay: {
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
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
});
