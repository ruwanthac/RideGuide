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
} from 'react-native';
import { PrimaryButton, InputField, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { shadows } from '../constants/theme';

const LOGO_IMAGE = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600';
const HERO_IMAGE = 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800';

interface LoginScreenProps {
  onLogin: () => void;
  onNavigateToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onNavigateToRegister,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [imageError, setImageError] = useState(false);
  const { spacing, fontSizes, width, scale } = useResponsive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        heroSection: {
          height: scale(200),
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
          backgroundColor: 'rgba(37, 99, 235, 0.4)',
        },
        logoContainer: {
          position: 'absolute',
          bottom: -scale(50),
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 2,
        },
        logoWrapper: {
          width: scale(100),
          height: scale(100),
          borderRadius: scale(24),
          backgroundColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          ...shadows.lg,
        },
        logoImage: {
          width: '100%',
          height: '100%',
          resizeMode: 'cover',
        },
        logoFallback: {
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
        },
        scrollContent: {
          flexGrow: 1,
          paddingTop: scale(70),
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
      }),
    [spacing, fontSizes, width, scale]
  );

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
          <View style={[StyleSheet.absoluteFillObject, styles.logoFallback]}>
            <Icon name="car" size={scale(80)} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.heroOverlay} />
        <View style={styles.logoContainer}>
          <View style={styles.logoWrapper}>
            {!imageError ? (
              <Image
                source={{ uri: LOGO_IMAGE }}
                style={styles.logoImage}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <View style={[styles.logoFallback, { backgroundColor: colors.primary }]}>
                <Icon name="car" size={scale(44)} color="#FFFFFF" />
              </View>
            )}
          </View>
        </View>
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
                />
                <InputField
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <TouchableOpacity style={styles.forgotRow} activeOpacity={0.7}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                <PrimaryButton title="Sign In" onPress={onLogin} style={styles.button} />
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
