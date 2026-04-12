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
} from 'react-native';
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
  const [imageError, setImageError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { spacing, fontSizes, width, scale } = useResponsive();

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
      }),
    [spacing, fontSizes, width, scale]
  );

  const handleRegister = () => {
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('Fill in name, email, and password.');
      return;
    }
    setSubmitting(true);
    void registerWithEmail(name, email, password)
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
                  Sign up to start diagnosing your vehicle
                </Text>
              </View>

              <View style={styles.form}>
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
                <InputField
                  label="Password"
                  placeholder="Create a strong password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

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
