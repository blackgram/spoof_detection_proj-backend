import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { activateTotp } from '@/api/totpActivation';
import { useAppColors, useIsDarkMode } from '@/hooks/use-app-colors';
import { useAuth } from '@/context/AuthContext';
import type { ChannelCode } from '@/api/totpActivation';

const CHANNELS: { code: ChannelCode; name: string }[] = [
  { code: 'IBANK', name: 'Access Bank' },
  { code: 'SME', name: 'Access SME' },
  { code: 'PRIMUSPLUS', name: 'Primus Plus' },
];

// Icon options are currently unused in app UI.
// const ICON_OPTIONS: { value: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
//   { value: 'building', icon: 'business-outline' },
//   { value: 'briefcase', icon: 'briefcase-outline' },
//   { value: 'person', icon: 'person-outline' },
//   { value: 'wallet', icon: 'wallet-outline' },
// ];

// Color options are currently unused in app UI.
// const COLOR_OPTIONS = [
//   '#003883', '#FF8200', '#10B981', '#8B5CF6',
//   '#EC4899', '#06B6D4', '#F59E0B', '#EF4444',
// ];

type FloatingInputProps = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'characters' | 'sentences' | 'words';
  isCode?: boolean;
};

function FloatingInput({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'none',
  isCode = false,
}: FloatingInputProps) {
  const c = useAppColors();
  const [focused, setFocused] = useState(false);
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const active = focused || !!value;

  useEffect(() => {
    Animated.timing(labelAnim, {
      toValue: active ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [active, labelAnim]);

  const labelTop = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [17, 6] });
  const labelSize = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 11] });
  const labelColor = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [c.textMuted, c.primary],
  });

  return (
    <View style={[fi.wrap, { backgroundColor: c.inputBackground, borderColor: focused ? c.primary : c.border }]}>
      <Animated.Text style={[fi.label, { top: labelTop, fontSize: labelSize, color: labelColor }]}>
        {label}
      </Animated.Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize={autoCapitalize}
        placeholder={active ? (placeholder ?? '') : ''}
        placeholderTextColor={c.textMuted}
        style={[
          fi.input,
          {
            color: c.text,
            fontFamily: isCode ? undefined : 'Inter_400Regular',
            letterSpacing: isCode ? 3 : 0,
          },
        ]}
      />
    </View>
  );
}

const fi = StyleSheet.create({
  wrap: {
    height: 56,
    borderRadius: 10,
    borderWidth: 1.5,
    position: 'relative',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  label: {
    position: 'absolute',
    left: 14,
    fontFamily: 'Inter_500Medium',
  },
  input: {
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 8,
    fontSize: 15,
    height: 56,
  },
});

export default function ManualSetupScreen() {
  const c = useAppColors();
  const isDark = useIsDarkMode();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { setupToken } = useAuth();

  const [activationCode, setActivationCode] = useState('');
  const [channelUsername, setChannelUsername] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<typeof CHANNELS[0] | null>(null);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof params.code === 'string' && params.code.length > 0) {
      setActivationCode(params.code.toUpperCase());
    }
  }, [params.code]);

  const canSubmit =
    channelUsername.trim().length > 0 &&
    activationCode.trim().length >= 6 &&
    selectedChannel !== null;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedChannel) return;
    setLoading(true);
    try {
      const activated = await activateTotp({
        channelUsername: channelUsername.trim(),
        channel: selectedChannel.code,
        activationCode: activationCode.trim().toUpperCase(),
      });

      await setupToken({
        username: activated.keycloakUsername,
        issuer: selectedChannel.name,
        label: `${channelUsername.trim()} (${selectedChannel.name})`,
        secret: activated.totpSecret,
        channel: selectedChannel.code,
        channelUsername: channelUsername.trim(),
        keycloakUserId: activated.keycloakUserId,
        keycloakUsername: activated.keycloakUsername,
        // color: selectedColor,
        // icon: selectedIcon,
        // tokenType,
      });
      setShowChannelPicker(false);
      setShowErrorModal(false);
      router.replace('/(tabs)');
    } catch (e: any) {
      setErrorMessage(e?.message || 'Could not activate token.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}> 
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
          <Ionicons name="arrow-back" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>Enter details</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FloatingInput
            label="Activation code"
            value={activationCode}
            onChangeText={setActivationCode}
            placeholder="XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            isCode
          />

          <FloatingInput
            label="Username"
            value={channelUsername}
            onChangeText={setChannelUsername}
            placeholder="Enter your username"
          />

          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: c.textMuted }]}>Channel</Text>
            <TouchableOpacity
              onPress={() => setShowChannelPicker(true)}
              style={[s.channelBtn, { backgroundColor: c.inputBackground, borderColor: c.border }]}
              activeOpacity={0.8}
            >
              <View style={[s.channelIcon, { backgroundColor: c.accent }]}>
                <Ionicons name="business-outline" size={18} color={c.primary} />
              </View>
              <Text style={[s.channelBtnText, { color: selectedChannel ? c.text : c.textMuted }]}> 
                {selectedChannel?.name ?? 'Select channel'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={[s.note, { backgroundColor: isDark ? '#1a1a28' : '#F5F5F8' }]}> 
            <Text style={[s.noteText, { color: c.textMuted }]}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: c.text }}>Note: </Text>
              This token is linked to your device. Reinstalling the app or changing devices will require new token activation.
            </Text>
          </View>

          {/* Icon picker is currently unused in app UI. */}
          {/*
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: c.textMuted }]}>Icon</Text>
            <View style={s.iconGrid}>
              {ICON_OPTIONS.map(({ value, icon }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setSelectedIcon(value)}
                  style={[
                    s.iconOption,
                    {
                      borderColor: selectedIcon === value ? c.primary : c.border,
                      backgroundColor: selectedIcon === value ? c.accent : c.surface,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons name={icon} size={20} color={c.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
          */}

          {/* Color picker is currently unused in app UI. */}
          {/*
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: c.textMuted }]}>Color</Text>
            <View style={s.colorGrid}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  style={[
                    s.colorSwatch,
                    { backgroundColor: color },
                    selectedColor === color && s.colorSwatchSelected,
                  ]}
                  activeOpacity={0.8}
                />
              ))}
            </View>
          </View>
          */}
        </ScrollView>

        <View style={[s.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}> 
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
            style={({ pressed }) => [
              s.submitBtn,
              { backgroundColor: canSubmit ? c.primary : (isDark ? '#2a2a38' : '#e0e0e8') },
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              (!canSubmit || loading) && { opacity: 0.5 },
            ]}
          >
            <Text style={[s.submitBtnText, { color: canSubmit ? '#fff' : c.textMuted }]}>
              {loading ? 'Activating…' : 'Add token'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showChannelPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChannelPicker(false)}
      >
        <Pressable style={s.backdrop} onPress={() => setShowChannelPicker(false)} />
        <View style={[s.sheet, { backgroundColor: c.surface }]}> 
          <View style={[s.sheetHeader, { borderBottomColor: c.border }]}> 
            <Text style={[s.sheetTitle, { color: c.text }]}>Select Channel</Text>
            <TouchableOpacity onPress={() => setShowChannelPicker(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>
          {CHANNELS.map((channel) => {
            const isSelected = selectedChannel?.code === channel.code;
            return (
              <TouchableOpacity
                key={channel.code}
                onPress={() => { setSelectedChannel(channel); setShowChannelPicker(false); }}
                style={[
                  s.sheetItem,
                  { borderBottomColor: c.border },
                  isSelected && { backgroundColor: c.accent },
                ]}
                activeOpacity={0.8}
              >
                <Text style={[s.sheetItemText, { color: c.text }]}>{channel.name}</Text>
                {isSelected && <Ionicons name="checkmark" size={16} color={c.primary} />}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 34 }} />
        </View>
      </Modal>

      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <Pressable style={s.backdrop} onPress={() => setShowErrorModal(false)} />
        <View style={[s.errorModalCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[s.errorIconWrap, { backgroundColor: isDark ? '#2a0a12' : '#fff0f3' }]}>
            <Ionicons name="alert-circle-outline" size={28} color={c.error} />
          </View>
          <Text style={[s.errorTitle, { color: c.text }]}>Activation Failed</Text>
          <Text style={[s.errorDescription, { color: c.textMuted }]}>{errorMessage}</Text>
          <TouchableOpacity
            style={[s.errorCta, { backgroundColor: c.primary }]}
            activeOpacity={0.85}
            onPress={() => setShowErrorModal(false)}
          >
            <Text style={s.errorCtaText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_500Medium' },

  scroll: { padding: 16, paddingBottom: 24 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
  },

  // Channel button
  channelBtn: {
    height: 56,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  channelIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelBtnText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },

  // Note
  note: { borderRadius: 10, padding: 12, marginBottom: 20 },
  noteText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },

  // Icon picker (unused)
  iconGrid: { flexDirection: 'row', gap: 10 },
  iconOption: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Color picker (unused)
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: { width: 44, height: 44, borderRadius: 8 },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },

  bottomBar: { padding: 16, borderTopWidth: 1 },
  submitBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetItemText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  errorModalCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '34%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
  },
  errorIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorCta: {
    minWidth: 140,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  errorCtaText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});
