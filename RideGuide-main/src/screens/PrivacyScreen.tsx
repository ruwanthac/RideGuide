import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, PrimaryButton } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../backend/userProfileService';
import { extractApiError } from '../backend/apiClient';

interface PrivacyScreenProps {
  onBack: () => void;
}

export const PrivacyScreen: React.FC<PrivacyScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { spacing, fontSizes, borderRadius, iconSizes } = useResponsive();
  const { user, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [savedDisplayName, setSavedDisplayName] = useState(user?.displayName ?? '');
  const [savedPhoneNumber, setSavedPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasUnsavedChanges =
    displayName.trim() !== savedDisplayName.trim() ||
    phoneNumber.trim() !== savedPhoneNumber.trim();

  const onSave = async () => {
    const name = displayName.trim();
    const trimmed = phoneNumber.trim();
    if (!name) {
      Alert.alert('Display name required', 'Please enter how you want your name to appear.');
      return;
    }
    if (!trimmed) {
      Alert.alert('Phone number required', 'Please enter a phone number.');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({ displayName: name, phoneNumber: trimmed });
      await refreshProfile();
      setSavedDisplayName(name);
      setSavedPhoneNumber(trimmed);
      setIsEditing(false);
      Alert.alert('Saved', 'Your account details were updated.');
    } catch (error) {
      Alert.alert('Update failed', extractApiError(error, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.sm),
        },
        topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
        backBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.card,
          marginRight: spacing.sm,
        },
        backIcon: { fontSize: iconSizes.md, color: colors.text },
        title: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.text },
        hint: { marginTop: spacing.xs, color: colors.textSecondary, fontSize: fontSizes.sm },
        label: { marginBottom: spacing.xs, color: colors.textSecondary, fontSize: fontSizes.sm, fontWeight: '600' },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: colors.text,
          fontSize: fontSizes.md,
        },
      }),
    [borderRadius.md, fontSizes.md, fontSizes.sm, fontSizes.xl, iconSizes.md, insets.bottom, insets.top, spacing.lg, spacing.md, spacing.sm, spacing.xs],
  );

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Privacy</Text>
      </View>

      <Card padded>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          value={displayName}
          onChangeText={(text) => setDisplayName(text)}
          placeholder="Your name"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { marginBottom: spacing.sm }]}
          editable={isEditing}
        />
        <Text style={styles.label}>Phone (E.164 recommended)</Text>
        <TextInput
          value={phoneNumber}
          onChangeText={(text) => setPhoneNumber(text)}
          keyboardType="phone-pad"
          placeholder="+94771234567"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          editable={isEditing}
        />
        <Text style={styles.hint}>
          Saved to your account on the server (same data the admin dashboard reads).
        </Text>
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <PrimaryButton
          title={saving ? 'Saving...' : isEditing ? 'Save account' : 'Edit account'}
          onPress={() => {
            if (!isEditing) {
              setIsEditing(true);
              return;
            }
            if (!hasUnsavedChanges) {
              setIsEditing(false);
              return;
            }
            void onSave();
          }}
          disabled={saving}
        />
      </View>
    </View>
  );
};
