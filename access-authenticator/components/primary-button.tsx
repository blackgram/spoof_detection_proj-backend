import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppColors, useIsDarkMode } from '@/hooks/use-app-colors';

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
  const isDark = useIsDarkMode();

  const filledBg = isDark ? c.orange : c.blue;
  const filledText = '#FFFFFF';
  const outlineBorder = isDark ? c.orange : c.blue;
  const outlineText = isDark ? c.orange : c.blue;

  const buttonStyle: StyleProp<ViewStyle> = [
    styles.btn,
    variant === 'filled'
      ? { backgroundColor: filledBg }
      : {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: outlineBorder,
        },
    (disabled || loading) && styles.disabled,
  ];

  const textColor =
    variant === 'filled' ? filledText : outlineText;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [buttonStyle, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'filled' ? '#FFF' : outlineText} />
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.5,
  },
});
