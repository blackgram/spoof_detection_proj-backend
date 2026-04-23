import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import React, { useState } from 'react'
import { useAppColors } from '@/hooks/use-app-colors';

type PasswordInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

export const PasswordInput = ({ value, onChangeText, placeholder }: PasswordInputProps) => {
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const c = useAppColors();
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: c.textMuted }]}>Password</Text>
      <TextInput
        style={[styles.input, { color: c.textMuted, backgroundColor: c.surface, borderColor: c.border }]}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        secureTextEntry={secureTextEntry}
        value={value}
        onChangeText={onChangeText}
      />
      <TouchableOpacity style={styles.eyeIcon} onPress={() => setSecureTextEntry(!secureTextEntry)}>
        <Text>{secureTextEntry ? 'Show' : 'Hide'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,

  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
});