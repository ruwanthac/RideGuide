import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card, PrimaryButton } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../backend/userProfileService';

interface PrivacyScreenProps {
  onBack: () => void;
}

export const PrivacyScreen: React.FC<PrivacyScreenProps> = ({ onBack }) => {
  const { spacing, fontSizes, borderRadius, iconSizes } = useResponsive();
  const { user, refreshProfile } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      Alert.alert('Phone number required', 'Please enter a phone number.');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({ phoneNumber: trimmed });
      await refreshProfile();
      Alert.alert('Saved', 'Phone number updated.');
      onBack();
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
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
    [borderRadius.md, fontSizes.md, fontSizes.sm, fontSizes.xl, iconSizes.md, spacing.lg, spacing.md, spacing.sm, spacing.xs],
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
        <Text style={styles.label}>Vehicle Owner Phone Number</Text>
        <TextInput
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          placeholder="e.g. +94 77 123 4567"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <Text style={styles.hint}>
          This number is shared with tow drivers when you place a tow booking.
        </Text>
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <PrimaryButton title={saving ? 'Saving...' : 'Save Phone Number'} onPress={onSave} disabled={saving} />
      </View>
    </View>
  );
};
