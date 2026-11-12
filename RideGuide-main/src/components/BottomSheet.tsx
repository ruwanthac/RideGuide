import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { colors } from '../constants/theme';
import { changePasswordWithApi } from '../backend/authService';
import { friendlyErrorMessage } from '../backend/apiClient';

const INK = '#0F172A';

/** Shared look for the slide-up form sheets on the Profile screens. */
export const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '800', color: INK },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: INK, marginBottom: 6 },
  input: { height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#CBD5E1', paddingHorizontal: 14, fontSize: 16, color: INK },
  error: { color: colors.error, fontSize: 14, fontWeight: '600' },
  primary: { height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});

/** A modal sheet with a title and close button; children are the form. */
export const BottomSheet: React.FC<{ visible: boolean; title: string; onClose: () => void; children: React.ReactNode }> = ({
  visible,
  title,
  onClose,
  children,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={sheetStyles.backdrop} onPress={onClose} accessibilityLabel="Close">
          <Pressable
            style={[sheetStyles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
            onPress={() => undefined}
            accessible={false}
          >
            <View style={sheetStyles.head}>
              <Text style={sheetStyles.title} accessibilityRole="header">
                {title}
              </Text>
              <Pressable style={sheetStyles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                <Icon name="close" size={20} color={INK} />
              </Pressable>
            </View>
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/** Labelled text field for the sheets. */
export const SheetField: React.FC<{ id: string; label: string } & React.ComponentProps<typeof TextInput>> = ({ id, label, style, ...props }) => (
  <View>
    <Text style={sheetStyles.label} nativeID={id}>
      {label}
    </Text>
    <TextInput
      style={[sheetStyles.input, style]}
      placeholderTextColor="#94A3B8"
      accessibilityLabelledBy={id}
      accessibilityLabel={label}
      {...props}
    />
  </View>
);

/** New password + confirm, saved through the API. */
export const ChangePasswordSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setPw('');
    setPw2('');
    setError(null);
    onClose();
  };

  const save = async () => {
    if (pw.length < 8) return setError('Your password must be at least 8 characters.');
    if (pw !== pw2) return setError('The two passwords don’t match.');
    setError(null);
    setSaving(true);
    try {
      await changePasswordWithApi(pw);
      close();
      Alert.alert('Password changed', 'Use your new password next time you sign in.');
    } catch (e) {
      setError(friendlyErrorMessage(e, "We couldn't change your password. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const busyStyle = useMemo(() => [sheetStyles.primary, saving && sheetStyles.pressed], [saving]);

  return (
    <BottomSheet visible={visible} title="Change password" onClose={close}>
      <SheetField
        id="pw-new"
        label="New password"
        value={pw}
        onChangeText={setPw}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        placeholder="At least 8 characters"
      />
      <SheetField
        id="pw-again"
        label="Type it again"
        value={pw2}
        onChangeText={setPw2}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
      />
      {error ? (
        <Text style={sheetStyles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Pressable style={busyStyle} onPress={() => void save()} disabled={saving} accessibilityRole="button">
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={sheetStyles.primaryText}>Change password</Text>}
      </Pressable>
    </BottomSheet>
  );
};
