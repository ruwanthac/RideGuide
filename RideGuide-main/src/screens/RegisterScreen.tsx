import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PrimaryButton, InputField, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { shadows } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { formatAuthError } from '../backend';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onNavigateToLogin }) => {
  const { registerWithEmail } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [accountType, setAccountType] = useState<'owner' | 'mechanic' | 'tow'>('owner');
  const [imageError, setImageError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [truckName, setTruckName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [mechanicBrUri, setMechanicBrUri] = useState<string | null>(null);
  const [mechanicNicUri, setMechanicNicUri] = useState<string | null>(null);
  const [towCompanyBrUri, setTowCompanyBrUri] = useState<string | null>(null);
  const [towCompanyNicUri, setTowCompanyNicUri] = useState<string | null>(null);
  const [towTruckRegUri, setTowTruckRegUri] = useState<string | null>(null);
  const [towTruckNicUri, setTowTruckNicUri] = useState<string | null>(null);

  const { spacing, fontSizes, width, scale, borderRadius, iconSizes } = useResponsive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        heroSection: {
          height: scale(160),
          backgroundColor: colors.primary,
          overflow: 'hidden',
        },
        heroImage: {
          width: '100%',
          height: '100%',
          resizeMode: 'cover',
          opacity: 0.85,
        },
        heroOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(37, 99, 235, 0.35)',
        },
        scrollContent: {
          flexGrow: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl,
          paddingBottom: spacing.xl * 2,
        },
        content: {
          maxWidth: Math.min(400, width * 0.92),
          width: '100%',
          alignSelf: 'center',
        },
        formCard: {
          backgroundColor: colors.card,
          borderRadius: scale(24),
          padding: spacing.xl,
          marginBottom: spacing.xl,
          ...shadows.md,
        },
        headerRow: {
          marginBottom: spacing.xl,
        },
        title: {
          fontSize: fontSizes.xxxl,
          fontWeight: '700',
          color: colors.text,
          marginBottom: spacing.xs,
        },
        subtitle: {
          fontSize: fontSizes.md,
          color: colors.textSecondary,
        },
        form: {
          marginBottom: spacing.md,
        },
        button: {
          marginTop: spacing.sm,
        },
        divider: {
          flexDirection: 'row',
          alignItems: 'center',
          marginVertical: spacing.xl,
        },
        dividerLine: {
          flex: 1,
          height: 1,
          backgroundColor: colors.border,
        },
        dividerText: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          paddingHorizontal: spacing.md,
        },
        loginPrompt: {
          alignItems: 'center',
          paddingVertical: spacing.md,
        },
        loginText: {
          fontSize: fontSizes.md,
          color: colors.textSecondary,
        },
        loginLink: {
          color: colors.primary,
          fontWeight: '700',
        },
        errorText: {
          fontSize: fontSizes.sm,
          color: colors.error,
          marginBottom: spacing.sm,
          textAlign: 'center',
        },
        accountTypeLabel: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.sm,
        },
        roleRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
        roleChip: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: scale(20),
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
        roleChipActive: {
          borderColor: colors.primary,
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
        },
        roleChipText: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          fontWeight: '600',
        },
        roleChipTextActive: {
          color: colors.primary,
        },
        providerSectionTitle: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: colors.text,
          marginTop: spacing.md,
          marginBottom: spacing.sm,
        },
        docCard: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
          padding: spacing.sm,
          marginBottom: spacing.sm,
          backgroundColor: colors.background,
        },
        docLabel: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
          color: colors.textSecondary,
          marginBottom: spacing.xs,
        },
        docPreview: {
          width: '100%',
          height: scale(100),
          borderRadius: borderRadius.md,
          backgroundColor: colors.card,
          marginBottom: spacing.xs,
        },
        docActions: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
        docBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.sm,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.primary,
          backgroundColor: 'rgba(37,99,235,0.06)',
        },
        docBtnText: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
          color: colors.primary,
          marginLeft: spacing.xs,
        },
      }),
    [spacing, fontSizes, width, scale, borderRadius, iconSizes]
  );

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow gallery access to upload documents.');
      return false;
    }
    return true;
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to capture documents.');
      return false;
    }
    return true;
  };

  const pickImage = async (setter: (u: string) => void) => {
    if (!(await requestGalleryPermission())) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setter(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Upload failed', 'Could not open the gallery.');
    }
  };

  const captureImage = async (setter: (u: string) => void) => {
    if (!(await requestCameraPermission())) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setter(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Capture failed', 'Could not use the camera.');
    }
  };

  const renderDocRow = (label: string, uri: string | null, setUri: (u: string) => void) => (
    <View style={styles.docCard}>
      <Text style={styles.docLabel}>{label}</Text>
      {uri ? <Image source={{ uri }} style={styles.docPreview} resizeMode="cover" /> : null}
      <View style={styles.docActions}>
        <TouchableOpacity style={styles.docBtn} onPress={() => pickImage(setUri)} activeOpacity={0.8}>
          <Icon name="image" size={iconSizes.sm} color={colors.primary} />
          <Text style={styles.docBtnText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.docBtn} onPress={() => captureImage(setUri)} activeOpacity={0.8}>
          <Icon name="camera" size={iconSizes.sm} color={colors.primary} />
          <Text style={styles.docBtnText}>Camera</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleRegister = () => {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError('Fill in name and email.');
      return;
    }
    if (accountType === 'owner' && !password) {
      setError('Owner accounts need a password.');
      return;
    }
    if (accountType === 'owner' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    let provider:
      | {
          businessName: string;
          businessAddress?: string;
          truckName?: string;
          plateNumber?: string;
          files: Record<string, string>;
        }
      | undefined;

    if (accountType === 'mechanic') {
      if (!businessName.trim() || !businessAddress.trim()) {
        setError('Enter workshop name and address.');
        return;
      }
      if (!mechanicBrUri || !mechanicNicUri) {
        setError('Upload BR copy and NIC copy.');
        return;
      }
      provider = {
        businessName: businessName.trim(),
        businessAddress: businessAddress.trim(),
        files: {
          mechanicBrCopy: mechanicBrUri,
          mechanicNicCopy: mechanicNicUri,
        },
      };
    } else if (accountType === 'tow') {
      if (!businessName.trim() || !truckName.trim() || !plateNumber.trim()) {
        setError('Enter company name, truck name, and plate number.');
        return;
      }
      if (!towCompanyBrUri || !towCompanyNicUri || !towTruckRegUri || !towTruckNicUri) {
        setError('Upload all four document images.');
        return;
      }
      provider = {
        businessName: businessName.trim(),
        truckName: truckName.trim(),
        plateNumber: plateNumber.trim(),
        files: {
          towCompanyBrCopy: towCompanyBrUri,
          towCompanyNicCopy: towCompanyNicUri,
          towTruckRegCopy: towTruckRegUri,
          towTruckNicCopy: towTruckNicUri,
        },
      };
    }

    setSubmitting(true);
    void registerWithEmail(
      name.trim(),
      email.trim(),
      accountType === 'owner' ? password : undefined,
      accountType,
      phone.trim() || undefined,
      provider
    )
      .then(({ pendingVerification }) => {
        if (pendingVerification) {
          Alert.alert(
            'Application submitted',
            'Your documents are under review. When an admin approves your account, you will receive an email with a one-time password to sign in.',
            [{ text: 'OK', onPress: onNavigateToLogin }]
          );
        }
      })
      .catch((e) => setError(formatAuthError(e)))
      .finally(() => setSubmitting(false));
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroSection}>
        {!imageError ? (
          <Image
            source={{ uri: HERO_IMAGE }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <Icon name="car" size={scale(72)} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.heroOverlay} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.formCard}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                  {accountType === 'owner'
                    ? 'Sign up as a vehicle owner — diagnostics, history, and roadside help.'
                    : accountType === 'mechanic'
                    ? 'Sign up as a mechanic — submit workshop verification on this screen.'
                    : 'Sign up as a tow driver — submit company and truck documents on this screen.'}
                </Text>
              </View>

              <View style={styles.form}>
                <Text style={styles.accountTypeLabel}>I am signing up as</Text>
                <View style={styles.roleRow}>
                  {(
                    [
                      { id: 'owner' as const, label: 'Vehicle owner' },
                      { id: 'mechanic' as const, label: 'Mechanic' },
                      { id: 'tow' as const, label: 'Tow driver' },
                    ] as const
                  ).map(({ id, label }) => (
                    <TouchableOpacity
                      key={id}
                      style={[styles.roleChip, accountType === id && styles.roleChipActive]}
                      onPress={() => setAccountType(id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.roleChipText, accountType === id && styles.roleChipTextActive]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <InputField
                  label="Full Name"
                  placeholder="John Doe"
                  value={name}
                  onChangeText={setName}
                />
                <InputField
                  label="Email Address"
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {accountType === 'owner' ? (
                  <InputField
                    label="Password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                ) : null}
                <InputField
                  label="Phone (optional)"
                  placeholder="+94771234567"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                {accountType === 'mechanic' && (
                  <>
                    <Text style={styles.providerSectionTitle}>Workshop verification</Text>
                    <InputField
                      label="Workshop / business name"
                      placeholder="e.g. Alex Auto Garage"
                      value={businessName}
                      onChangeText={setBusinessName}
                    />
                    <InputField
                      label="Workshop address"
                      placeholder="Street, city"
                      value={businessAddress}
                      onChangeText={setBusinessAddress}
                    />
                    {renderDocRow('Business registration (BR) copy', mechanicBrUri, setMechanicBrUri)}
                    {renderDocRow('NIC copy', mechanicNicUri, setMechanicNicUri)}
                  </>
                )}

                {accountType === 'tow' && (
                  <>
                    <Text style={styles.providerSectionTitle}>Company & truck verification</Text>
                    <InputField
                      label="Company name"
                      placeholder="e.g. Colombo Tow Services"
                      value={businessName}
                      onChangeText={setBusinessName}
                    />
                    <InputField
                      label="Truck name / label"
                      placeholder="e.g. Tow Truck A"
                      value={truckName}
                      onChangeText={setTruckName}
                    />
                    <InputField
                      label="Plate number"
                      placeholder="e.g. WP-1234"
                      value={plateNumber}
                      onChangeText={setPlateNumber}
                      autoCapitalize="characters"
                    />
                    {renderDocRow('Company BR copy', towCompanyBrUri, setTowCompanyBrUri)}
                    {renderDocRow('Company NIC copy', towCompanyNicUri, setTowCompanyNicUri)}
                    {renderDocRow('Truck registration copy', towTruckRegUri, setTowTruckRegUri)}
                    {renderDocRow('Truck NIC copy', towTruckNicUri, setTowTruckNicUri)}
                  </>
                )}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {submitting ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
                ) : (
                  <PrimaryButton
                    title="Create Account"
                    onPress={handleRegister}
                    style={styles.button}
                  />
                )}
              </View>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Already have an account?</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.loginPrompt}
              onPress={onNavigateToLogin}
              activeOpacity={0.7}
            >
              <Text style={styles.loginText}>
                Sign in instead{' '}
                <Text style={styles.loginLink}>Log In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};
