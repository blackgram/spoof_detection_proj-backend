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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { login, loginWithBiometrics, getProfile, getLastUsername, isLoading, deviceChanged } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [hasStoredUser, setHasStoredUser] = useState(false);
  const [storedUsername, setStoredUsername] = useState('');

  useEffect(() => {
    (async () => {
      const last = await getLastUsername();
      if (last?.trim()) {
        const profile = await getProfile(last.trim());
        if (profile?.hasBiometrics) {
          setStoredUsername(last.trim());
          setUsername(last.trim());
          setHasStoredUser(true);
          return;
        }
        setUsername(last.trim());
      }
    })();
  }, [getLastUsername, getProfile]);

  const isBiometricMode = hasStoredUser && !password.trim();

  const handleSignIn = async () => {
    if (isBiometricMode) {
      setAuthLoading(true);
      try {
        await loginWithBiometrics(storedUsername);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[Login] Biometric sign-in failed:', msg, e);
        Alert.alert('Sign in with Biometrics', msg || 'Please try again.');
      } finally {
        setAuthLoading(false);
      }
    } else {
      const name = username.trim();
      if (!name) {
        Alert.alert('Username required', 'Enter your username to sign in.');
        return;
      }
      if (!password.trim()) {
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
    }
  };

  const handleUnlockDevice = () => {
    Alert.alert(
      'Unlock this device?',
      'This will clear the saved user for biometric sign-in on this device. You will need to enter your username and password again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock',
          style: 'destructive',
          onPress: () => {
            setHasStoredUser(false);
            setStoredUsername('');
            setUsername('');
            setPassword('');
          },
        },
      ]
    );
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
            <Image source={require('../../assets/Access-bank-logo.png')} style={styles.logo} />
          </View>

          <View style={styles.welcomeArea}>
            {hasStoredUser ? (
              <Text style={styles.welcome}>
                Welcome back, <Text style={styles.welcomeName}>{storedUsername}</Text>
              </Text>
            ) : (
              <Text style={styles.welcome}>Sign in to continue</Text>
            )}
          </View>

          {deviceChanged && (
            <View style={styles.deviceBanner}>
              <Text style={styles.deviceBannerText}>
                New device detected. You may need to complete KYC again for high-value transfers and limit increases.
              </Text>
            </View>
          )}

          {!hasStoredUser && (
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
          )}

          <TextInput
            style={styles.input}
            placeholder="Password"
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
              pressed && styles.primaryButtonPressed,
              authLoading && styles.primaryButtonDisabled,
            ]}
            onPress={handleSignIn}
            disabled={authLoading}
          >
            <Text style={styles.primaryButtonText}>
              {authLoading
                ? 'Signing in...'
                : isBiometricMode
                  ? 'SIGN IN WITH BIOMETRICS'
                  : 'SIGN IN'}
            </Text>
          </Pressable>

          {hasStoredUser && (
            <View style={styles.unlockRow}>
              <Text style={styles.unlockText}>Not {storedUsername}? </Text>
              <Pressable onPress={handleUnlockDevice}>
                <Text style={styles.unlockLink}>Unlock device</Text>
              </Pressable>
            </View>
          )}

          {!hasStoredUser && (
            <View style={styles.linksRow}>
              <Pressable onPress={() => navigation.navigate('DeviceChange')}>
                <Text style={styles.linkText}>
                  New device? <Text style={styles.linkBold}>Change here</Text>
                </Text>
              </Pressable>
              <View style={styles.linkDivider} />
              <Pressable onPress={() => navigation.navigate('Register')}>
                <Text style={styles.linkText}>
                  <Text style={styles.linkBold}>Register</Text>
                </Text>
              </Pressable>
            </View>
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
  logo: {
    width: 160,
    height: 40,
    resizeMode: 'contain',
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
  welcomeArea: {
    marginTop: 150,
    marginBottom: spacing.md,
  },
  welcome: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  welcomeName: {
    color: colors.text,
    fontWeight: '700',
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
    borderRadius: radius.full,
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
  unlockRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  unlockText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  unlockLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  linksRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
  },
  linkBold: {
    fontWeight: '700',
  },
  linkDivider: {
    height: 1,
    width: 24,
    backgroundColor: colors.border,
  },
  footer: {
    marginTop: 'auto',
    paddingVertical: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
  },
});
