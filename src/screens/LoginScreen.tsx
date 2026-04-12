import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { PrimaryButton, InputField, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { shadows } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { formatAuthError } from '../backend';

const APP_NAME = 'Vehicle Diagnosis';
const APP_TAGLINE = 'Smart diagnostics at your fingertips';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigateToRegister }) => {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { spacing, fontSizes, width, scale, verticalScale } = useResponsive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        heroSection: {
          backgroundColor: colors.primary,
          paddingTop: verticalScale(60),
          paddingBottom: verticalScale(40),
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomLeftRadius: scale(32),
          borderBottomRightRadius: scale(32),
          ...shadows.lg,
        },
        logoCircle: {
          width: scale(100),
          height: scale(100),
          borderRadius: scale(50),
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
          ...shadows.md,
        },
        appName: {
          fontSize: fontSizes.xxxl,
          fontWeight: '700',
          color: '#FFFFFF',
          marginBottom: spacing.xs,
          textAlign: 'center',
        },
        appTagline: {
          fontSize: fontSizes.md,
          color: 'rgba(255, 255, 255, 0.9)',
          textAlign: 'center',
        },
        scrollContent: {
          flexGrow: 1,
          paddingTop: spacing.xl,
          paddingHorizontal: spacing.lg,
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
        welcomeRow: {
          alignItems: 'center',
          marginBottom: spacing.xl,
        },
        title: {
          fontSize: fontSizes.xxxl,
          fontWeight: '700',
          color: colors.text,
          marginBottom: spacing.xs,
          textAlign: 'center',
        },
        subtitle: {
          fontSize: fontSizes.md,
          color: colors.textSecondary,
          textAlign: 'center',
        },
        form: {
          marginBottom: spacing.md,
        },
        forgotRow: {
          alignItems: 'flex-end',
          marginTop: -spacing.sm,
          marginBottom: spacing.lg,
        },
        forgotText: {
          fontSize: fontSizes.sm,
          color: colors.primary,
          fontWeight: '600',
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
        registerPrompt: {
          alignItems: 'center',
          paddingVertical: spacing.md,
        },
        registerText: {
          fontSize: fontSizes.md,
          color: colors.textSecondary,
        },
        registerLink: {
          color: colors.primary,
          fontWeight: '700',
        },
        errorText: {
          fontSize: fontSizes.sm,
          color: colors.error,
          marginBottom: spacing.sm,
          textAlign: 'center',
        },
      }),
    [spacing, fontSizes, width, scale, verticalScale]
  );

  const handleSignIn = () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    void signInWithEmail(email, password)
      .catch((e) => setError(formatAuthError(e)))
      .finally(() => setSubmitting(false));
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroSection}>
        <View style={styles.logoCircle}>
          <Icon name="car" size={scale(50)} color={colors.primary} />
        </View>
        <Text style={styles.appName}>{APP_NAME}</Text>
        <Text style={styles.appTagline}>{APP_TAGLINE}</Text>
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
              <View style={styles.welcomeRow}>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>
                  Sign in to access your vehicle diagnostics
                </Text>
              </View>

              <View style={styles.form}>
                <InputField
                  label="Email Address"
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  containerStyle={{ marginBottom: spacing.sm }}
                />
                <InputField
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                />
                <TouchableOpacity style={styles.forgotRow} activeOpacity={0.7}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {submitting ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
                ) : (
                  <PrimaryButton title="Sign In" onPress={handleSignIn} style={styles.button} />
                )}
              </View>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>New to the app?</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.registerPrompt}
              onPress={onNavigateToRegister}
              activeOpacity={0.7}
            >
              <Text style={styles.registerText}>
                Create an account{' '}
                <Text style={styles.registerLink}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};
