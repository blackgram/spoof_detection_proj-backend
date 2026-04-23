import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import FingerprintIcon from '../components/Icons/FingerprintIcon';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TransactionPin'>;
type PinRoute = RouteProp<RootStackParamList, 'TransactionPin'>;

const PIN_LENGTH = 4;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

export default function TransactionPinScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<PinRoute>();
  const { next } = route.params;
  const { user, clearBiometricsForUsername } = useAuth();
  const [pin, setPin] = useState('');

  const handlePinComplete = async () => {
    switch (next.type) {
      case 'device_change':
        navigation.replace('KYCBvn', {
          reason: 'device_change',
          customerId: next.customerId,
          username: next.username,
        });
        break;

      case 'enable_biometrics':
        navigation.replace('KYCBvn', { reason: 'biometrics' });
        break;

      case 'disable_biometrics': {
        const username = user?.name?.trim();
        if (username) {
          await clearBiometricsForUsername(username);
        }
        navigation.goBack();
        break;
      }

      case 'adjust_limit':
        navigation.replace('Limit' as any);
        break;

      case 'setup_token':
        navigation.replace('KYCBvn', { reason: 'token_setup' });
        break;
    }
  };

  const handleDigit = (digit: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      handlePinComplete();
    }
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
  };

  const handleClose = () => navigation.goBack();

  const renderKey = (key: string, idx: number) => {
    if (key === 'bio') {
      return (
        <Pressable
          key="bio"
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          onPress={() => {}}
        >
          <FingerprintIcon size={30} color={colors.primary} />
        </Pressable>
      );
    }
    if (key === 'back') {
      return (
        <Pressable
          key="back"
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          onPress={handleBackspace}
        >
          <Text style={styles.backIcon}>⌫</Text>
        </Pressable>
      );
    }
    return (
      <Pressable
        key={key}
        style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
        onPress={() => handleDigit(key)}
      >
        <Text style={styles.keyText}>{key}</Text>
        <View style={styles.keyUnderline} />
      </Pressable>
    );
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Enter Transaction PIN</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.dotsRow}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < pin.length && styles.dotFilled]}
            />
          ))}
        </View>

        <View style={styles.keypad}>
          {KEYS.map((key, idx) => renderKey(key, idx))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeIcon: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '600',
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dotFilled: {
    backgroundColor: colors.primary,
  },

  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 0,
  },
  key: {
    width: SCREEN_WIDTH / 3 - spacing.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    opacity: 0.5,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '500',
    color: colors.primary,
  },
  keyUnderline: {
    width: 28,
    height: 1.5,
    backgroundColor: colors.primary,
    marginTop: 6,
    borderRadius: 1,
  },
  backIcon: {
    fontSize: 24,
    color: colors.primary,
  },
});
