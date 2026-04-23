import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/context/AuthContext';
import { useAppColors } from '@/hooks/use-app-colors';
import { PasswordInput } from '@/components/password-input';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const c = useAppColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  function handleSubmit() {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    signIn(email, password);
    setLoading(false);
  }

  return (
    <AuthScreen
      title=""
      subtitle=""
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>A</Text>
      </View>
      <View style={styles.welcomeArea}>
      <Text style={[styles.title, { color: c.text }]}>Welcome back</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>Sign in to continue to your account.</Text>
      </View>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your email"
        keyboardType="email-address"
      />
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
      />
      <View style={styles.forgotPassword}>
        <Text style={{ color: c.orange }}>Forgot password?</Text>
      </View>
      {error ? (
        <Text style={[styles.error, { color: c.error }]}>{error}</Text>
      ) : null}
      <PrimaryButton label={`${password === "" && biometricsEnabled ? (!loading ? 'Sign in with Biometrics' : 'Signing In') : (loading ? 'Signing in...' : 'Sign in')} `} onPress={handleSubmit} />
      <View style={styles.footer}>
        <Text style={{ color: c.textMuted }}>Don&apos;t have an account? </Text>
        <Link href="/(auth)/signup" asChild>
          <Pressable hitSlop={8}>
            <Text style={[styles.link, { color: c.orange }]}>Sign up</Text>
          </Pressable>
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 14, marginTop: -4 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 50,
    backgroundColor: "#EA580C",
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  link: { fontSize: 16, fontWeight: '600' },
  avatarText: {
    fontSize:24,
    fontWeight: '700',
    color: 'white',
  },
  welcomeArea: {
    marginTop: 2,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 16,
    fontSize: 12,
    fontWeight: '600',
  },
});
