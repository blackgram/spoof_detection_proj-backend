import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export default function ScanScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.centered}>
        <Text style={styles.icon}>📷</Text>
        <Text style={styles.title}>Scan</Text>
        <Text style={styles.subtitle}>QR code scanner coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  icon: { fontSize: 48, marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 15, color: colors.textSecondary },
});
