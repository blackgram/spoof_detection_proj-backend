import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { ensureCustomerByUsername } from '../api/customers';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DeviceChange'>;

export default function DeviceChangeScreen() {
  const navigation = useNavigation<Nav>();
  const [loginId, setLoginId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangeDevice = async () => {
    const user = loginId.trim();
    const acc = accountNumber.trim();
    if (!user) {
      Alert.alert('Required', 'Please enter your Login ID.');
      return;
    }
    if (!acc) {
      Alert.alert('Required', 'Please enter your account number.');
      return;
    }
    setLoading(true);
    try {
      const { customer_id } = await ensureCustomerByUsername(user);
      navigation.navigate('TransactionPin', {
        next: { type: 'device_change', customerId: customer_id, username: user },
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.title}>Change Device</Text>
          <View style={styles.progressBar}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.message}>
            An OTP will be sent to the phone number connected to your account.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Login ID"
            placeholderTextColor={colors.textMuted}
            value={loginId}
            onChangeText={setLoginId}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Account Number"
            placeholderTextColor={colors.textMuted}
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="number-pad"
            editable={!loading}
          />

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              loading && styles.primaryButtonDisabled,
            ]}
            onPress={handleChangeDevice}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Please wait...' : 'CHANGE DEVICE'}
            </Text>
          </Pressable>

          <Text style={styles.footer}>
            Completing a Change Device request will set a transaction limit of ₦50,000 on your
            profile for the next 24 hours.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  backArrow: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    width: '33%',
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
    paddingVertical: spacing.lg,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
