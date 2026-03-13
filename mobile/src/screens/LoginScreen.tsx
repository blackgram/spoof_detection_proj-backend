import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';

export default function LoginScreen() {
  const { login, loginWithBiometrics, getProfile, getLastUsername, isLoading, deviceChanged } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [biometricsEnabledForUsername, setBiometricsEnabledForUsername] = useState<boolean>(false);

  useEffect(() => {
    getLastUsername().then((last) => {
      if (last) setUsername(last);
    });
  }, [getLastUsername]);

  const refreshProfileForUsername = useCallback(
    async (name: string) => {
      if (!name.trim()) {
        setBiometricsEnabledForUsername(false);
        return;
      }
      const profile = await getProfile(name);
      setBiometricsEnabledForUsername(!!profile?.hasBiometrics);
    },
    [getProfile]
  );

  useEffect(() => {
    refreshProfileForUsername(username);
  }, [username, refreshProfileForUsername]);

  const handlePasswordLogin = async () => {
    const name = username.trim();
    if (!name) {
      Alert.alert('Username required', 'Enter your username to sign in.');
      return;
    }
    if (!password) {
      Alert.alert('Password required', 'Enter your password to sign in.');
      return;
    }
    setAuthLoading(true);
    try {
      await login(name, password);
    } catch (e) {
      Alert.alert('Login failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    const name = username.trim();
    if (!name) {
      Alert.alert('Username required', 'Enter your username to sign in with biometrics.');
      return;
    }
    setAuthLoading(true);
    try {
      await loginWithBiometrics(name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Login] Biometric sign-in failed:', msg, e);
      Alert.alert('Sign in with Biometrics', msg || 'Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom', 'left', 'right']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox} />
            <Text style={styles.brand}>access</Text>
            <Text style={styles.brandDot}>more</Text>
          </View>

          <Text style={styles.welcome}>Sign in to continue</Text>

          {deviceChanged && (
            <View style={styles.deviceBanner}>
              <Text style={styles.deviceBannerText}>
                New device detected. You may need to complete KYC again for high-value transfers and limit increases.
              </Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!authLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (optional for biometrics)"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!authLoading}
          />

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (authLoading || !password.trim()) && styles.primaryButtonDisabled,
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={handlePasswordLogin}
            disabled={authLoading || !password.trim()}
          >
            <Text style={styles.primaryButtonText}>
              {authLoading ? 'Signing in...' : 'SIGN IN'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.biometricButton,
              (!username.trim() || !biometricsEnabledForUsername) && styles.primaryButtonDisabled,
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={handleBiometricLogin}
            disabled={authLoading || !username.trim() || !biometricsEnabledForUsername}
          >
            <Text style={styles.biometricButtonText}>SIGN IN WITH BIOMETRICS</Text>
          </Pressable>
          {username.trim() && !biometricsEnabledForUsername && (
            <Text style={styles.hint}>
              Sign in with password first, then enable biometrics in the app to use this option.
            </Text>
          )}

          <Text style={styles.footer}>© Access Bank PLC. (Proof of concept)</Text>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: 12,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    transform: [{ rotate: '45deg' }],
  },
  brand: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
  brandDot: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  welcome: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  deviceBanner: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  deviceBannerText: {
    color: colors.text,
    fontSize: 14,
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
    marginTop: spacing.sm,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  biometricButton: {
    marginTop: spacing.md,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
  },
  biometricButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footer: {
    marginTop: 'auto',
    paddingVertical: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
  },
});
