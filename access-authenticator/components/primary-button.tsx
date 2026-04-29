import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppColors } from '@/hooks/use-app-colors';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'filled' | 'outline';
  icon?: ReactNode;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'filled',
  icon,
}: PrimaryButtonProps) {
  const c = useAppColors();

  const buttonStyle: StyleProp<ViewStyle> = [
    styles.btn,
    variant === 'filled'
      ? { backgroundColor: c.primary }
      : {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: c.primary,
        },
    (disabled || loading) && styles.disabled,
  ];

  const textColor = variant === 'filled' ? '#FFFFFF' : c.primary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [buttonStyle, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'filled' ? '#FFF' : c.primary} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
