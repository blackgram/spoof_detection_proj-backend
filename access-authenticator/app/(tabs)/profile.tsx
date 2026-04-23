import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/context/AuthContext';
import { useAppColors } from '@/hooks/use-app-colors';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const c = useAppColors();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.label, { color: c.textMuted }]}>Name</Text>
        <Text style={[styles.value, { color: c.text }]}>{user?.name}</Text>
        <Text style={[styles.label, { color: c.textMuted, marginTop: 16 }]}>Email</Text>
        <Text style={[styles.value, { color: c.text }]}>{user?.email}</Text>
      </View>
      <PrimaryButton label="Sign out" onPress={signOut} variant="outline" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 18, fontWeight: '600', marginTop: 4 },
});
