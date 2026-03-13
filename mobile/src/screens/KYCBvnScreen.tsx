import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'KYCBvn'>;

export default function KYCBvnScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { reason } = (route.params ?? {}) as { reason: 'transfer' | 'limit' | 'biometrics' };

  const [bvn, setBvn] = useState('');

  const canProceed = bvn.trim().length >= 10;

  const handleProceed = () => {
    if (!canProceed) return;
    navigation.navigate('KYCCapture', {
      mode: 'onboarding',
      reason,
      bvn: bvn.trim(),
      name: user?.name ?? 'Customer',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Enter your BVN</Text>
          <Text style={styles.subtitle}>
            Your Bank Verification Number is required for KYC. You’ll capture your reference photo on the next screen.
          </Text>
          <Text style={styles.label}>BVN (11 digits)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 12345678901"
            placeholderTextColor={colors.textMuted}
            value={bvn}
            onChangeText={setBvn}
            keyboardType="number-pad"
            maxLength={11}
            autoFocus
          />
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              !canProceed && styles.primaryButtonDisabled,
              pressed && canProceed && styles.primaryButtonPressed,
            ]}
            onPress={handleProceed}
            disabled={!canProceed}
          >
            <Text style={styles.primaryButtonText}>Proceed to capture</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonPressed: { opacity: 0.9 },
  primaryButtonDisabled: { backgroundColor: colors.disabled },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: { alignItems: 'center', paddingVertical: spacing.md },
  cancelButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
