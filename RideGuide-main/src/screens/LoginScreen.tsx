import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { formatAuthError } from '../backend';

export const APP_NAME = 'RideGuide';

const NIGHT = '#0B1220';
const INK = '#0F172A';
const MUTED = '#64748B';

const FEATURES: { title: string; text: string; icon: IconName | 'tow-truck' }[] = [
  { title: 'AI diagnosis', text: 'Describe the problem or enter an OBD code.', icon: 'construct' },
  { title: 'Live Vehicle Expert', text: 'Show the problem on camera and ask.', icon: 'videocam' },
  { title: 'Roadside help and towing', text: 'Nearby mechanics and tow trucks, tracked live.', icon: 'tow-truck' },
];

interface LoginScreenProps {
  onNavigateToRegister: () => void;
}

/** Welcome screen: what the app does, with sign-up up front and sign-in in a sheet. */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigateToRegister }) => {
  const { signInWithEmail } = useAuth();
  const insets = useSafeAreaInsets();
  const { scale } = useResponsive();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSignIn = () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    void signInWithEmail(email.trim(), password)
      .catch((e) => setError(formatAuthError(e)))
      .finally(() => setSubmitting(false));
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: NIGHT },
        content: {
          flexGrow: 1,
          paddingTop: insets.top + 28,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
          paddingHorizontal: 24,
        },
        brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
        brand: { color: '#F8FAFC', fontSize: 20, fontWeight: '800' },
        headline: {
          color: '#F8FAFC',
          fontSize: Math.round(scale(36)),
          lineHeight: Math.round(scale(40)),
          fontWeight: '800',
          letterSpacing: -1,
          marginTop: 48,
        },
        features: { marginTop: 36, gap: 20 },
        feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
        featureIcon: {
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: 'rgba(96,165,250,0.16)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        featureTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
        featureText: { color: '#CBD5E1', fontSize: 14, lineHeight: 20, marginTop: 3 },
        spacer: { flex: 1, minHeight: 32 },
        primary: { height: 54, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
        primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
        secondary: {
          height: 54,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: '#334155',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 12,
        },
        secondaryText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
        pressed: { opacity: 0.85 },
        // Sign-in sheet
        backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.6)', justifyContent: 'flex-end' },
        sheet: {
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 12,
        },
        handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1', marginBottom: 12 },
        sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
        sheetTitle: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5 },
        closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
        label: { fontSize: 14, fontWeight: '600', color: INK, marginBottom: 6 },
        input: {
          height: 52,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: '#CBD5E1',
          paddingHorizontal: 16,
          fontSize: 16,
          color: INK,
          marginBottom: 16,
        },
        passwordWrap: { justifyContent: 'center' },
        eye: { position: 'absolute', right: 4, top: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        error: { color: colors.error, fontSize: 14, fontWeight: '600', marginBottom: 12 },
        sheetFooter: { textAlign: 'center', color: MUTED, fontSize: 15, marginTop: 18 },
        link: { color: colors.primary, fontWeight: '700' },
      }),
    [insets, scale]
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Icon name="car" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.brand}>{APP_NAME}</Text>
        </View>

        <Text style={styles.headline} accessibilityRole="header">
          Car trouble? Get answers in minutes.
        </Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <View style={styles.featureIcon}>
                {f.icon === 'tow-truck' ? (
                  <MaterialCommunityIcons name="tow-truck" size={22} color="#93C5FD" />
                ) : (
                  <Icon name={f.icon} size={21} color="#93C5FD" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          onPress={onNavigateToRegister}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Create an account</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          onPress={() => {
            setError(null);
            setSheetOpen(true);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>I already have an account</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} accessibilityLabel="Close sign in">
            <Pressable style={styles.sheet} onPress={() => undefined} accessible={false}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle} accessibilityRole="header">
                  Welcome back
                </Text>
                <Pressable style={styles.closeBtn} onPress={() => setSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Close">
                  <Icon name="close" size={20} color={INK} />
                </Pressable>
              </View>

              <Text style={styles.label} nativeID="signin-email">
                Email
              </Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                accessibilityLabelledBy="signin-email"
                accessibilityLabel="Email"
              />
              <Text style={styles.label} nativeID="signin-password">
                Password
              </Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { paddingRight: 52 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleSignIn}
                  accessibilityLabelledBy="signin-password"
                  accessibilityLabel="Password"
                />
                <Pressable
                  style={styles.eye}
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={MUTED} />
                </Pressable>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                style={({ pressed }) => [styles.primary, (pressed || submitting) && styles.pressed]}
                onPress={handleSignIn}
                disabled={submitting}
                accessibilityRole="button"
              >
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Sign in</Text>}
              </Pressable>
              <Text style={styles.sheetFooter}>
                New here?{' '}
                <Text
                  style={styles.link}
                  onPress={() => {
                    setSheetOpen(false);
                    onNavigateToRegister();
                  }}
                  accessibilityRole="link"
                >
                  Create an account
                </Text>
              </Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};
