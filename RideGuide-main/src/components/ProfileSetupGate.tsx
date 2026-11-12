import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useVehicles } from '../context/VehiclesContext';
import { updateUserProfile } from '../backend/userProfileService';
import { friendlyErrorMessage } from '../backend/apiClient';
import { hasSavedProfilePhone } from '../utils/profilePhone';
import type { AuthUser, Vehicle } from '../backend/types';
import { InputField } from './InputField';
import { PrimaryButton } from './PrimaryButton';
import { Icon } from './Icon';

const filled = (v: string | null | undefined) => typeof v === 'string' && v.trim().length > 0;

/**
 * What a signed-in account still has to fill in before using the app, or null when it's complete.
 * Owners need a vehicle (diagnosis and tow booking depend on it); mechanics and tow drivers need
 * their business/truck details and a phone number (required to accept jobs).
 */
export function setupNeeded(
  user: AuthUser,
  vehicles: Vehicle[],
  vehiclesStatus: 'loading' | 'ready' | 'error'
): 'owner' | 'mechanic' | 'tow' | null {
  if (user.role === 'owner') return vehiclesStatus === 'ready' && vehicles.length === 0 ? 'owner' : null;
  if (user.role === 'mechanic') {
    return filled(user.businessName) && filled(user.businessAddress) && hasSavedProfilePhone(user.phoneNumber)
      ? null
      : 'mechanic';
  }
  if (user.role === 'tow') {
    return filled(user.businessName) && filled(user.truckName) && filled(user.plateNumber) && hasSavedProfilePhone(user.phoneNumber)
      ? null
      : 'tow';
  }
  return null;
}

const COPY = {
  owner: {
    icon: 'car' as const,
    title: 'Last step: your vehicle',
    subtitle: 'We use these details for diagnoses, tow bookings and to give advice that fits your vehicle.',
    button: 'Save and continue',
  },
  mechanic: {
    icon: 'construct' as const,
    title: 'Your workshop details',
    subtitle: 'Vehicle owners see these when you accept their request. Check they’re correct.',
    button: 'Save and continue',
  },
  tow: {
    icon: 'car' as const,
    title: 'Your tow truck details',
    subtitle: 'Vehicle owners see these when you accept their tow. Check they’re correct.',
    button: 'Save and continue',
  },
};

const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,18}$/;

/** Shows the setup form in place of the app until the account has the details it needs. */
export const ProfileSetupGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { vehicles, vehiclesStatus } = useVehicles();
  if (!user) return <>{children}</>;
  if (user.role === 'owner' && vehiclesStatus === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  const needed = setupNeeded(user, vehicles, vehiclesStatus);
  if (!needed) return <>{children}</>;
  return <ProfileSetupForm user={user} kind={needed} />;
};

const ProfileSetupForm: React.FC<{ user: AuthUser; kind: 'owner' | 'mechanic' | 'tow' }> = ({ user, kind }) => {
  const { refreshProfile, signOutUser } = useAuth();
  const { addVehicle, setSelectedVehicleId } = useVehicles();
  const { spacing, fontSizes, scale } = useResponsive();
  const insets = useSafeAreaInsets();
  const copy = COPY[kind];
  const askPhone = kind !== 'owner' || !hasSavedProfilePhone(user.phoneNumber);

  const [nickname, setNickname] = useState('');
  const [makeModel, setMakeModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [vin, setVin] = useState('');
  const [businessName, setBusinessName] = useState(user.businessName ?? '');
  const [businessAddress, setBusinessAddress] = useState(user.businessAddress ?? '');
  const [truckName, setTruckName] = useState(user.truckName ?? '');
  const [truckPlate, setTruckPlate] = useState(user.plateNumber ?? '');
  const [phone, setPhone] = useState(user.phoneNumber ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const firstName = (user.displayName || '').trim().split(/\s+/)[0];
  // Right after sign-up this is step 5 of 5, so it continues the sign-up progress bar.
  const justSignedUp = kind === 'owner' && Date.now() - Date.parse(user.createdAt) < 24 * 60 * 60 * 1000;

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (kind === 'owner') {
      if (!makeModel.trim()) e.makeModel = 'Please enter the make and model, e.g. Toyota Axio.';
      const y = Number(year);
      const maxYear = new Date().getFullYear() + 1;
      if (!/^\d{4}$/.test(year.trim()) || y < 1950 || y > maxYear) e.year = `Please enter a year between 1950 and ${maxYear}.`;
      if (!plate.trim()) e.plate = 'Please enter the plate number, e.g. CAB-4521.';
      if (!vin.trim()) e.vin = 'Please enter the VIN or chassis number.';
    }
    if (kind === 'mechanic') {
      if (!businessName.trim()) e.businessName = 'Please enter your workshop name.';
      if (!businessAddress.trim()) e.businessAddress = 'Please enter your workshop address.';
    }
    if (kind === 'tow') {
      if (!businessName.trim()) e.businessName = 'Please enter your company name.';
      if (!truckName.trim()) e.truckName = 'Please enter a name for your truck.';
      if (!truckPlate.trim()) e.truckPlate = 'Please enter the truck’s plate number.';
    }
    if (askPhone && !PHONE_PATTERN.test(phone.trim())) {
      e.phone = 'Please enter a valid phone number, e.g. +94771234567.';
    }
    return e;
  };

  const onSave = async () => {
    const e = validate();
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    try {
      if (kind === 'owner') {
        // Phone first: adding the vehicle completes setup and closes this screen.
        if (askPhone) await updateUserProfile({ phoneNumber: phone.trim() });
        const created = await addVehicle({
          label: nickname.trim() || 'My vehicle',
          makeModel: makeModel.trim(),
          year: Number(year),
          plate: plate.trim().toUpperCase(),
          vin: vin.trim().toUpperCase(),
        });
        await setSelectedVehicleId(created._id);
      } else {
        await updateUserProfile({
          businessName: businessName.trim(),
          phoneNumber: phone.trim(),
          ...(kind === 'mechanic'
            ? { businessAddress: businessAddress.trim() }
            : { truckName: truckName.trim(), plateNumber: truckPlate.trim().toUpperCase() }),
        });
        await refreshProfile();
      }
    } catch (err) {
      setFormError(friendlyErrorMessage(err, "We couldn't save your details. Please try again."));
      setSaving(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: {
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg,
        },
        icon: {
          width: scale(64),
          height: scale(64),
          borderRadius: scale(32),
          backgroundColor: '#DBEAFE',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
        },
        progress: { flexDirection: 'row', gap: 6, marginBottom: spacing.xl },
        progressSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.primary },
        welcome: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.primary, marginBottom: 4 },
        title: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
        subtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          lineHeight: Math.round(fontSizes.sm * 1.5),
          marginBottom: spacing.lg,
        },
        card: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.md, marginBottom: spacing.lg },
        sectionLabel: {
          fontSize: fontSizes.xs,
          fontWeight: '700',
          color: colors.textSecondary,
          letterSpacing: 0.5,
          marginBottom: spacing.sm,
        },
        row: { flexDirection: 'row', gap: spacing.md },
        hint: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: -spacing.sm, marginBottom: spacing.md },
        formError: {
          color: colors.error,
          fontSize: fontSizes.sm,
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: spacing.md,
        },
        signOut: { alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm },
        signOutText: { color: colors.textSecondary, fontSize: fontSizes.sm },
      }),
    [spacing, fontSizes, scale, insets]
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {justSignedUp ? (
          <View style={styles.progress} accessibilityLabel="Step 5 of 5">
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.progressSeg} />
            ))}
          </View>
        ) : null}
        <View style={styles.icon}>
          <Icon name={copy.icon} size={scale(30)} color={colors.primary} />
        </View>
        {firstName ? <Text style={styles.welcome}>Welcome, {firstName}!</Text> : null}
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        {kind === 'owner' ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>VEHICLE</Text>
            <InputField
              label="Make & model"
              placeholder="e.g. Toyota Axio"
              value={makeModel}
              onChangeText={setMakeModel}
              error={errors.makeModel}
              autoCapitalize="words"
            />
            <View style={styles.row}>
              <InputField
                label="Year"
                placeholder="e.g. 2016"
                value={year}
                onChangeText={(t) => setYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
                error={errors.year}
                keyboardType="number-pad"
                containerStyle={{ flex: 1 }}
              />
              <InputField
                label="Plate number"
                placeholder="e.g. CAB-4521"
                value={plate}
                onChangeText={setPlate}
                error={errors.plate}
                autoCapitalize="characters"
                containerStyle={{ flex: 1 }}
              />
            </View>
            <InputField
              label="VIN or chassis number"
              placeholder="e.g. NZE141-1234567"
              value={vin}
              onChangeText={setVin}
              error={errors.vin}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {!errors.vin ? (
              <Text style={styles.hint}>You'll find it on your vehicle registration certificate (CR).</Text>
            ) : null}
            <InputField
              label="Nickname (optional)"
              placeholder="e.g. Family car"
              value={nickname}
              onChangeText={setNickname}
            />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{kind === 'mechanic' ? 'WORKSHOP' : 'COMPANY & TRUCK'}</Text>
            <InputField
              label={kind === 'mechanic' ? 'Workshop name' : 'Company name'}
              placeholder={kind === 'mechanic' ? 'e.g. Sunil Auto Care' : 'e.g. Colombo Tow Services'}
              value={businessName}
              onChangeText={setBusinessName}
              error={errors.businessName}
            />
            {kind === 'mechanic' ? (
              <InputField
                label="Workshop address"
                placeholder="Street, city"
                value={businessAddress}
                onChangeText={setBusinessAddress}
                error={errors.businessAddress}
              />
            ) : (
              <View style={styles.row}>
                <InputField
                  label="Truck name"
                  placeholder="e.g. Tow Truck A"
                  value={truckName}
                  onChangeText={setTruckName}
                  error={errors.truckName}
                  containerStyle={{ flex: 1 }}
                />
                <InputField
                  label="Truck plate"
                  placeholder="e.g. WP-1234"
                  value={truckPlate}
                  onChangeText={setTruckPlate}
                  error={errors.truckPlate}
                  autoCapitalize="characters"
                  containerStyle={{ flex: 1 }}
                />
              </View>
            )}
          </View>
        )}

        {askPhone ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CONTACT</Text>
            <InputField
              label="Phone number"
              placeholder="+94771234567"
              value={phone}
              onChangeText={setPhone}
              error={errors.phone}
              keyboardType="phone-pad"
            />
            <Text style={styles.hint}>
              {kind === 'owner'
                ? 'Mechanics and tow drivers use it to reach you when they’re on the way.'
                : 'Vehicle owners use it to reach you. You need it to accept jobs.'}
            </Text>
          </View>
        ) : null}

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <PrimaryButton title={copy.button} onPress={onSave} loading={saving} disabled={saving} />

        <TouchableOpacity style={styles.signOut} onPress={() => void signOutUser()} accessibilityRole="button">
          <Text style={styles.signOutText}>Not now? Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
