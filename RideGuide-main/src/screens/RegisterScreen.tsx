import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
  type TextInputProps,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { formatAuthError } from '../backend';

type AccountType = 'owner' | 'mechanic' | 'tow';
type Step = 'type' | 'name' | 'contact' | 'password' | 'business' | 'documents';

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';

/** Owners finish with "add your vehicle" (step 5) after the account exists; providers with their documents. */
const TOTAL_STEPS = 5;
const STEPS: Record<AccountType, Step[]> = {
  owner: ['type', 'name', 'contact', 'password'],
  mechanic: ['type', 'name', 'contact', 'business', 'documents'],
  tow: ['type', 'name', 'contact', 'business', 'documents'],
};

const ROLES: { id: AccountType; title: string; text: string; tint: string; ink: string }[] = [
  { id: 'owner', title: 'Vehicle owner', text: 'Diagnose problems, talk to the AI expert, and book roadside help or a tow.', tint: '#DBEAFE', ink: '#1D4ED8' },
  { id: 'mechanic', title: 'Mechanic', text: 'Get roadside jobs from drivers near your workshop.', tint: '#FFEDD5', ink: '#C2410C' },
  { id: 'tow', title: 'Tow truck driver', text: 'Get tow jobs nearby and on schedule.', tint: '#DCFCE7', ink: '#15803D' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Accepts "0771234567", "771234567" or "+94 77 123 4567"; returns +94XXXXXXXXX, or null if it isn't 9 digits. */
export function toSriLankanMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('94') && digits.length === 11) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^\d{9}$/.test(digits) ? `+94${digits}` : null;
}

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
}

/** Sign-up, one question per screen. */
export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onNavigateToLogin }) => {
  const { registerWithEmail } = useAuth();
  const insets = useSafeAreaInsets();
  const { scale } = useResponsive();

  const [accountType, setAccountType] = useState<AccountType>('owner');
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [truckName, setTruckName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [docs, setDocs] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const secondFieldRef = useRef<TextInput>(null);

  const steps = STEPS[accountType];
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const isProvider = accountType !== 'owner';

  const requiredDocs: { key: string; label: string; hint: string }[] =
    accountType === 'mechanic'
      ? [
          { key: 'mechanicBrCopy', label: 'Business registration (BR)', hint: 'Photo of your BR certificate' },
          { key: 'mechanicNicCopy', label: 'National ID (NIC)', hint: 'Front of your NIC' },
        ]
      : [
          { key: 'towCompanyBrCopy', label: 'Company registration (BR)', hint: 'Photo of your BR certificate' },
          { key: 'towTruckRegCopy', label: 'Truck registration', hint: 'The truck’s registration certificate (CR)' },
          { key: 'towTruckNicCopy', label: 'Driver’s NIC', hint: 'Front of the driver’s NIC' },
        ];

  const goBack = () => {
    setError(null);
    if (stepIndex === 0) onNavigateToLogin();
    else setStepIndex((i) => i - 1);
  };

  /** Returns an error message for the current step, or null when it's complete. */
  const validateStep = (): string | null => {
    switch (step) {
      case 'name':
        return name.trim().length >= 2 ? null : 'Please enter your full name.';
      case 'contact':
        if (!EMAIL_PATTERN.test(email.trim())) return 'Please enter a valid email address.';
        if (!toSriLankanMobile(phone)) return 'Please enter a 9-digit mobile number, e.g. 77 123 4567.';
        return null;
      case 'password':
        if (password.length < 8) return 'Your password must be at least 8 characters.';
        if (password !== confirmPassword) return 'The two passwords don’t match.';
        return null;
      case 'business':
        if (!businessName.trim()) return accountType === 'mechanic' ? 'Please enter your workshop name.' : 'Please enter your company name.';
        if (accountType === 'mechanic' && !businessAddress.trim()) return 'Please enter your workshop address.';
        if (accountType === 'tow' && (!truckName.trim() || !plateNumber.trim())) return 'Please enter the truck name and plate number.';
        return null;
      case 'documents': {
        const missing = requiredDocs.find((d) => !docs[d.key]);
        return missing ? `Please add your ${missing.label}.` : null;
      }
      default:
        return null;
    }
  };

  const submit = () => {
    const mobile = toSriLankanMobile(phone) ?? phone.trim();
    const provider = isProvider
      ? {
          businessName: businessName.trim(),
          ...(accountType === 'mechanic'
            ? { businessAddress: businessAddress.trim() }
            : { truckName: truckName.trim(), plateNumber: plateNumber.trim().toUpperCase() }),
          files: Object.fromEntries(requiredDocs.map((d) => [d.key, docs[d.key] as string])),
        }
      : undefined;
    setSubmitting(true);
    void registerWithEmail(name.trim(), email.trim(), isProvider ? undefined : password, accountType, mobile, provider)
      .then(({ pendingVerification }) => {
        // Owners are signed in now and move on to "add your vehicle"; providers wait for approval.
        if (pendingVerification) setSubmitted(true);
      })
      .catch((e) => {
        const message = formatAuthError(e, "We couldn't create your account. Please try again.");
        // An email that's already registered is fixed on the contact step.
        if (/email/i.test(message)) setStepIndex(steps.indexOf('contact'));
        setError(message);
      })
      .finally(() => setSubmitting(false));
  };

  const next = () => {
    const problem = validateStep();
    setError(problem);
    if (problem) return;
    if (isLastStep) submit();
    else setStepIndex((i) => i + 1);
  };

  const pickDoc = async (key: string, source: 'gallery' | 'camera') => {
    const permission =
      source === 'gallery'
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(
        source === 'gallery' ? 'Allow access to photos' : 'Allow access to the camera',
        source === 'gallery'
          ? 'Please allow photo access in Settings to upload your documents.'
          : 'Please allow camera access in Settings to photograph your documents.'
      );
      return;
    }
    try {
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, quality: 0.85 };
      const result =
        source === 'gallery' ? await ImagePicker.launchImageLibraryAsync(options) : await ImagePicker.launchCameraAsync(options);
      const uri = result.canceled ? null : result.assets[0]?.uri;
      if (uri) {
        setDocs((d) => ({ ...d, [key]: uri }));
        setError(null);
      }
    } catch {
      Alert.alert(
        source === 'gallery' ? "Couldn't open photos" : "Couldn't open the camera",
        'Please try again.'
      );
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: '#FFFFFF' },
        top: { paddingTop: insets.top + 12, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 14 },
        backBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
        progress: { flex: 1, flexDirection: 'row', gap: 6 },
        progressSeg: { flex: 1, height: 5, borderRadius: 3 },
        body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
        stepLabel: { fontSize: 14, fontWeight: '600', color: MUTED },
        question: {
          fontSize: Math.round(scale(30)),
          lineHeight: Math.round(scale(35)),
          fontWeight: '800',
          color: INK,
          letterSpacing: -0.8,
          marginTop: 8,
        },
        helper: { fontSize: 16, lineHeight: 23, color: MUTED, marginTop: 10 },
        fields: { marginTop: 28, gap: 18 },
        bigInput: {
          height: 60,
          borderBottomWidth: 2,
          borderBottomColor: colors.primary,
          fontSize: 24,
          fontWeight: '600',
          color: INK,
          paddingHorizontal: 2,
        },
        label: { fontSize: 14, fontWeight: '600', color: INK, marginBottom: 6 },
        input: { height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: '#CBD5E1', paddingHorizontal: 16, fontSize: 16, color: INK },
        phoneRow: { flexDirection: 'row', gap: 8 },
        prefix: {
          height: 52,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: '#F1F5F9',
          alignItems: 'center',
          justifyContent: 'center',
        },
        prefixText: { fontSize: 16, fontWeight: '700', color: INK },
        eye: { position: 'absolute', right: 4, bottom: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        roleCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18 },
        roleIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
        roleTitle: { fontSize: 16, fontWeight: '700', color: INK },
        roleText: { fontSize: 13, lineHeight: 19, color: MUTED, marginTop: 3 },
        radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
        radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
        note: { fontSize: 13, lineHeight: 19, color: MUTED, marginTop: 16 },
        docCard: { borderWidth: 1.5, borderColor: LINE, borderRadius: 16, padding: 14, gap: 12 },
        docHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        docThumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
        docTitle: { fontSize: 15, fontWeight: '700', color: INK },
        docHint: { fontSize: 13, color: MUTED, marginTop: 2 },
        docActions: { flexDirection: 'row', gap: 10 },
        docBtn: {
          flex: 1,
          height: 44,
          borderRadius: 12,
          backgroundColor: '#EFF6FF',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        docBtnText: { color: '#1D4ED8', fontSize: 14, fontWeight: '700' },
        error: { color: colors.error, fontSize: 14, fontWeight: '600', marginTop: 16 },
        footer: { paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingTop: 8 },
        nextBtn: {
          height: 54,
          borderRadius: 16,
          backgroundColor: colors.primary,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        nextText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
        signIn: { textAlign: 'center', color: MUTED, fontSize: 14, marginTop: 14 },
        link: { color: colors.primary, fontWeight: '700' },
        pressed: { opacity: 0.85 },
        doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
      }),
    [insets, scale]
  );

  /** Labelled text field. A plain function, not a component, so inputs keep focus while typing. */
  const field = ({ label, id, style, ...props }: { label: string; id: string } & TextInputProps) => (
    <View key={id}>
      <Text style={styles.label} nativeID={id}>
        {label}
      </Text>
      <TextInput style={[styles.input, style]} placeholderTextColor="#94A3B8" accessibilityLabelledBy={id} accessibilityLabel={label} {...props} />
    </View>
  );

  if (submitted) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 80, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <StatusBar style="dark" />
        <View style={styles.doneIcon}>
          <Icon name="checkmark-circle" size={40} color="#15803D" />
        </View>
        <Text style={[styles.question, { marginTop: 24 }]} accessibilityRole="header">
          Application submitted
        </Text>
        <Text style={styles.helper}>
          Our team will check your documents. When your account is approved, we'll email {email.trim() || 'you'} a one-time
          password to sign in.
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]} onPress={onNavigateToLogin} accessibilityRole="button">
          <Text style={styles.nextText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  const roleTitle = ROLES.find((r) => r.id === accountType)?.title ?? '';
  const stepNumber = stepIndex + 1;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={styles.top}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel={stepIndex === 0 ? 'Back to welcome' : 'Previous step'}
        >
          <Icon name="chevron-back" size={20} color={INK} />
        </Pressable>
        <View style={styles.progress} accessibilityLabel={`Step ${stepNumber} of ${TOTAL_STEPS}`}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View key={i} style={[styles.progressSeg, { backgroundColor: i < stepNumber ? colors.primary : LINE }]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepLabel}>
          {step === 'type' ? `Step 1 of ${TOTAL_STEPS}` : `${roleTitle} · Step ${stepNumber} of ${TOTAL_STEPS}`}
        </Text>

        {step === 'type' ? (
          <>
            <Text style={styles.question} accessibilityRole="header">
              How will you use RideGuide?
            </Text>
            <Text style={styles.helper}>Pick the one that fits you.</Text>
            <View style={styles.fields} accessibilityRole="radiogroup">
              {ROLES.map((r) => {
                const on = r.id === accountType;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setAccountType(r.id)}
                    style={[
                      styles.roleCard,
                      { borderWidth: on ? 2 : 1.5, borderColor: on ? colors.primary : LINE, backgroundColor: on ? '#F8FAFF' : '#FFFFFF' },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${r.title}. ${r.text}`}
                  >
                    <View style={[styles.roleIcon, { backgroundColor: r.tint }]}>
                      {r.id === 'owner' ? (
                        <Icon name="car" size={24} color={r.ink} />
                      ) : r.id === 'mechanic' ? (
                        <Icon name="construct" size={22} color={r.ink} />
                      ) : (
                        <MaterialCommunityIcons name="tow-truck" size={24} color={r.ink} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleTitle}>{r.title}</Text>
                      <Text style={styles.roleText}>{r.text}</Text>
                    </View>
                    <View style={[styles.radio, { borderColor: on ? colors.primary : '#CBD5E1' }]}>{on ? <View style={styles.radioDot} /> : null}</View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.note}>
              Mechanics and tow drivers upload their documents during sign-up. Our team checks them before you can take jobs.
            </Text>
          </>
        ) : null}

        {step === 'name' ? (
          <>
            <Text style={styles.question} accessibilityRole="header" nativeID="q-name">
              What's your name?
            </Text>
            <Text style={styles.helper}>
              {isProvider
                ? 'Vehicle owners see it when you accept their request.'
                : 'Mechanics and tow drivers see it when they come to help you.'}
            </Text>
            <View style={styles.fields}>
              <TextInput
                style={styles.bigInput}
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                autoFocus
                returnKeyType="next"
                onSubmitEditing={next}
                accessibilityLabelledBy="q-name"
                accessibilityLabel="Full name"
              />
            </View>
          </>
        ) : null}

        {step === 'contact' ? (
          <>
            <Text style={styles.question} accessibilityRole="header">
              How can we reach you?
            </Text>
            <Text style={styles.helper}>
              {isProvider
                ? 'We’ll email you when your account is approved. Owners call this number when you’re on the way.'
                : 'You sign in with your email. Mechanics and tow drivers call this number when they’re on the way.'}
            </Text>
            <View style={styles.fields}>
              {field({
                id: 'f-email',
                label: 'Email',
                value: email,
                onChangeText: setEmail,
                placeholder: 'name@example.com',
                keyboardType: 'email-address',
                autoCapitalize: 'none',
                autoComplete: 'email',
                textContentType: 'emailAddress',
                returnKeyType: 'next',
                onSubmitEditing: () => secondFieldRef.current?.focus(),
              })}
              <View>
                <Text style={styles.label} nativeID="f-phone">
                  Mobile number
                </Text>
                <View style={styles.phoneRow}>
                  <View style={styles.prefix}>
                    <Text style={styles.prefixText}>+94</Text>
                  </View>
                  <TextInput
                    ref={secondFieldRef}
                    style={[styles.input, { flex: 1 }]}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="77 123 4567"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    returnKeyType="next"
                    onSubmitEditing={next}
                    accessibilityLabelledBy="f-phone"
                    accessibilityLabel="Mobile number"
                  />
                </View>
              </View>
            </View>
          </>
        ) : null}

        {step === 'password' ? (
          <>
            <Text style={styles.question} accessibilityRole="header">
              Create a password
            </Text>
            <Text style={styles.helper}>At least 8 characters. A short phrase is easy to remember and hard to guess.</Text>
            <View style={styles.fields}>
              <View>
                {field({
                  id: 'f-pass',
                  label: 'Password',
                  value: password,
                  onChangeText: setPassword,
                  secureTextEntry: !showPassword,
                  autoCapitalize: 'none',
                  autoComplete: 'new-password',
                  textContentType: 'newPassword',
                  style: { paddingRight: 52 },
                  returnKeyType: 'next',
                  onSubmitEditing: () => secondFieldRef.current?.focus(),
                })}
                <Pressable
                  style={styles.eye}
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={MUTED} />
                </Pressable>
              </View>
              <View>
                <Text style={styles.label} nativeID="f-pass2">
                  Type it again
                </Text>
                <TextInput
                  ref={secondFieldRef}
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={next}
                  accessibilityLabelledBy="f-pass2"
                  accessibilityLabel="Type the password again"
                />
              </View>
            </View>
          </>
        ) : null}

        {step === 'business' ? (
          <>
            <Text style={styles.question} accessibilityRole="header">
              {accountType === 'mechanic' ? 'Your workshop' : 'Your company and truck'}
            </Text>
            <Text style={styles.helper}>Vehicle owners see these details when you accept their job.</Text>
            <View style={styles.fields}>
              {field({ id: 'f-biz', label: accountType === 'mechanic' ? 'Workshop name' : 'Company name', value: businessName, onChangeText: setBusinessName, placeholder: accountType === 'mechanic' ? 'e.g. Sunil Auto Care' : 'e.g. Colombo Tow Services', autoCapitalize: "words" })}
              {accountType === 'mechanic' ? (
                field({ id: 'f-addr', label: "Workshop address", value: businessAddress, onChangeText: setBusinessAddress, placeholder: "Street, city", autoCapitalize: "words" })
              ) : (
                <>
                  {field({ id: 'f-truck', label: "Truck name", value: truckName, onChangeText: setTruckName, placeholder: "e.g. Tow Truck A" })}
                  {field({ id: 'f-plate', label: "Truck plate number", value: plateNumber, onChangeText: setPlateNumber, placeholder: "e.g. WP LK-1234", autoCapitalize: "characters" })}
                </>
              )}
            </View>
          </>
        ) : null}

        {step === 'documents' ? (
          <>
            <Text style={styles.question} accessibilityRole="header">
              Upload your documents
            </Text>
            <Text style={styles.helper}>Clear photos, with all four corners showing. Only our team sees them.</Text>
            <View style={styles.fields}>
              {requiredDocs.map((d) => {
                const uri = docs[d.key];
                return (
                  <View key={d.key} style={[styles.docCard, uri ? { borderColor: '#86EFAC' } : null]}>
                    <View style={styles.docHead}>
                      <View style={styles.docThumb}>
                        {uri ? (
                          <Image source={{ uri }} style={{ width: 52, height: 52 }} resizeMode="cover" accessibilityLabel={`${d.label} photo`} />
                        ) : (
                          <Icon name="document-text" size={22} color={MUTED} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docTitle}>{d.label}</Text>
                        <Text style={styles.docHint}>{uri ? 'Added. Tap below to replace it.' : d.hint}</Text>
                      </View>
                      {uri ? <Icon name="checkmark-circle" size={22} color="#15803D" /> : null}
                    </View>
                    <View style={styles.docActions}>
                      <Pressable
                        style={({ pressed }) => [styles.docBtn, pressed && styles.pressed]}
                        onPress={() => void pickDoc(d.key, 'camera')}
                        accessibilityRole="button"
                        accessibilityLabel={`Take a photo of your ${d.label}`}
                      >
                        <Icon name="camera" size={18} color="#1D4ED8" />
                        <Text style={styles.docBtnText}>Take photo</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.docBtn, pressed && styles.pressed]}
                        onPress={() => void pickDoc(d.key, 'gallery')}
                        accessibilityRole="button"
                        accessibilityLabel={`Choose a photo of your ${d.label}`}
                      >
                        <Icon name="image" size={18} color="#1D4ED8" />
                        <Text style={styles.docBtnText}>Choose photo</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.nextBtn, (pressed || submitting) && styles.pressed]}
          onPress={next}
          disabled={submitting}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.nextText}>
                {isLastStep ? (isProvider ? 'Submit application' : 'Create account') : 'Next'}
              </Text>
              {isLastStep ? null : <Icon name="chevron-forward" size={18} color="#FFFFFF" />}
            </>
          )}
        </Pressable>
        {step === 'type' ? (
          <Text style={styles.signIn}>
            Already have an account?{' '}
            <Text style={styles.link} onPress={onNavigateToLogin} accessibilityRole="link">
              Sign in
            </Text>
          </Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
};
