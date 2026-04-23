import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/hooks/use-app-colors';
import { useAuth } from '@/context/AuthContext';
import { TextField } from '@/components/text-field';
import { PrimaryButton } from '@/components/primary-button';

export default function ManualSetupScreen() {
  const c = useAppColors();
  const router = useRouter();
  const { setupToken } = useAuth();

  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [issuer, setIssuer] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length > 0 && secret.trim().length >= 16;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await setupToken({
        username: username.trim(),
        issuer: issuer.trim() || 'AccessMore',
        label: username.trim(),
        secret: secret.replace(/\s/g, '').toUpperCase(),
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Setup Failed', e.message || 'Could not save token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Ionicons name="close" size={28} color={c.text} onPress={() => router.back()} />
          <Text style={[styles.title, { color: c.text }]}>Manual Setup</Text>
          <View style={{ width: 28 }} />
        </View>

        <Text style={[styles.description, { color: c.textMuted }]}>
          Enter your username and the setup key provided by your banking channel.
        </Text>

        <View style={styles.fields}>
          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="e.g. john.doe"
          />
          <TextField
            label="Setup Key (Secret)"
            value={secret}
            onChangeText={setSecret}
            placeholder="e.g. JBSWY3DPEHPK3PXP"
            autoCapitalize="characters"
          />
          <TextField
            label="Issuer (optional)"
            value={issuer}
            onChangeText={setIssuer}
            placeholder="e.g. AccessMore"
          />
        </View>

        <PrimaryButton
          label={loading ? 'Setting up…' : 'Add Token'}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  fields: { gap: 16, marginBottom: 32 },
});
