import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { registerCustomer } from '../api/customers';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Register'>;

const PASSWORD_RULES = [
  { key: 'lower', label: '1 Lowercase', test: (p: string) => /[a-z]/.test(p) },
  { key: 'upper', label: '1 Uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'digit', label: '1 Digit', test: (p: string) => /\d/.test(p) },
  { key: 'length', label: '8 Characters', test: (p: string) => p.length >= 8 },
  { key: 'special', label: '1 Special Character', test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
];

export default function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const [accountNumber, setAccountNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordValid = PASSWORD_RULES.every((r) => r.test(password));
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleContinue = async () => {
    const acc = accountNumber.trim();
    const ph = phone.trim();
    const user = username.trim();
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!acc) {
      Alert.alert('Required', 'Please enter your account number.');
      return;
    }
    if (!ph) {
      Alert.alert('Required', 'Please enter your phone number.');
      return;
    }
    if (!fn) {
      Alert.alert('Required', 'Please enter your first name.');
      return;
    }
    if (!ln) {
      Alert.alert('Required', 'Please enter your last name.');
      return;
    }
    if (!user) {
      Alert.alert('Required', 'Please enter a desired username.');
      return;
    }
    if (!passwordValid) {
      Alert.alert('Password', 'Please meet all password requirements.');
      return;
    }
    if (!passwordsMatch) {
      Alert.alert('Password', 'Password and Confirm Password do not match.');
      return;
    }
    setLoading(true);
    try {
      const data = await registerCustomer({
        account_number: acc,
        phone: ph,
        username: user,
        password,
        first_name: fn,
        last_name: ln,
      });
      navigation.navigate('KYCBvn', {
        reason: 'registration',
        customerId: data.customer_id,
        username: data.username,
      });
    } catch (e) {
      Alert.alert('Registration failed', e instanceof Error ? e.message : 'Please try again.');
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
          <Text style={styles.title}>Registration</Text>
          <View style={styles.progressBar}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.welcome}>Welcome to Access!</Text>
          <Text style={styles.subtitle}>Register with an existing account. Please enter details below.</Text>

          <TextInput
            style={styles.input}
            placeholder="First name"
            placeholderTextColor={colors.textMuted}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Last name"
            placeholderTextColor={colors.textMuted}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
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
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor={colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Desired Username"
            placeholderTextColor={colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />
          <View style={styles.badges}>
            {PASSWORD_RULES.map((rule) => (
              <View
                key={rule.key}
                style={[styles.badge, rule.test(password) ? styles.badgeMet : styles.badgeUnmet]}
              >
                <Text style={[styles.badgeText, rule.test(password) && styles.badgeTextMet]}>
                  {rule.label}
                </Text>
              </View>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              loading && styles.primaryButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>{loading ? 'Please wait...' : 'CONTINUE'}</Text>
          </Pressable>
        </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  welcome: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
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
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeMet: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  badgeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  badgeTextMet: {
    color: colors.primary,
  },
  badgeUnmet: {},
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
});
