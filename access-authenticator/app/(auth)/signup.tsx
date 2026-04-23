import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/context/AuthContext';
import { useAppColors } from '@/hooks/use-app-colors';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const c = useAppColors();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit() {
    setError('');
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    signUp(name, email, password);
  }

  return (
    <AuthScreen
      title="Create account"
      subtitle="Sign up to get started with Access Authenticator."
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Jane Doe"
        autoCapitalize="words"
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
      />
      {error ? (
        <Text style={[styles.error, { color: c.error }]}>{error}</Text>
      ) : null}
      <PrimaryButton label="Create account" onPress={handleSubmit} />
      <View style={styles.footer}>
        <Text style={{ color: c.textMuted }}>Already have an account? </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable hitSlop={8}>
            <Text style={[styles.link, { color: c.orange }]}>Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 14, marginTop: -4 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  link: { fontSize: 16, fontWeight: '600' },
});
