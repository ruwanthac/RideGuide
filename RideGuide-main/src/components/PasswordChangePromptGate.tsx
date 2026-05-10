import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { Icon } from './Icon';
import { PrimaryButton } from './PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { changePasswordWithApi, formatAuthError } from '../backend';

/** After mechanic/tow login: OTP must-change, or optional “update password” prompt. Mounted inside Main so it survives auth navigation. */
export function PasswordChangePromptGate() {
  const { user, passwordChangePrompt, clearPasswordChangePrompt, refreshProfile, signOutUser } =
    useAuth();
  const { spacing, fontSizes, scale } = useResponsive();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [mandatory, setMandatory] = useState(false);
  const optionalAlertShownRef = useRef(false);

  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNextPassword, setShowNextPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        },
        sheet: {
          width: '100%',
          maxWidth: 420,
          backgroundColor: colors.card,
          borderRadius: scale(20),
          padding: spacing.lg,
        },
        dismissBtn: {
          position: 'absolute',
          top: spacing.sm,
          right: spacing.sm,
          zIndex: 2,
          padding: spacing.sm,
        },
        title: {
          fontSize: fontSizes.xl,
          fontWeight: '700',
          color: colors.text,
          marginBottom: spacing.xs,
          paddingRight: scale(36),
        },
        subtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginBottom: spacing.md,
          lineHeight: scale(20),
        },
        passwordRow: {
          position: 'relative',
          marginBottom: spacing.sm,
        },
        passwordInput: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: scale(12),
          backgroundColor: colors.background,
          color: colors.text,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          paddingRight: scale(46),
          fontSize: fontSizes.md,
        },
        eyeBtn: {
          position: 'absolute',
          right: spacing.sm,
          top: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          width: scale(32),
        },
        error: {
          fontSize: fontSizes.sm,
          color: colors.error,
          marginBottom: spacing.sm,
          textAlign: 'center',
        },
        signOutRow: {
          marginTop: spacing.md,
          alignItems: 'center',
          paddingVertical: spacing.sm,
        },
        signOutText: {
          fontSize: fontSizes.sm,
          color: colors.primary,
          fontWeight: '600',
        },
      }),
    [spacing, fontSizes, scale],
  );

  const isProvider = user?.role === 'mechanic' || user?.role === 'tow';

  useEffect(() => {
    if (!user) {
      optionalAlertShownRef.current = false;
      setSheetOpen(false);
      setMandatory(false);
      return;
    }

    if (user.mustChangePassword) {
      setMandatory(true);
      setSheetOpen(true);
      return;
    }

    setMandatory(false);

    if (
      passwordChangePrompt === 'optional' &&
      isProvider &&
      !optionalAlertShownRef.current
    ) {
      optionalAlertShownRef.current = true;
      const showAlert = () =>
        Alert.alert(
          'Change password?',
          'You can update your password now, or skip and do it later.',
          [
            {
              text: 'Later',
              style: 'cancel',
              onPress: () => clearPasswordChangePrompt(),
            },
            {
              text: 'Change password',
              onPress: () => {
                setChangeError(null);
                setNextPassword('');
                setConfirmPassword('');
                setMandatory(false);
                setSheetOpen(true);
              },
            },
          ],
        );
      if (Platform.OS === 'web') {
        queueMicrotask(showAlert);
      } else {
        setTimeout(showAlert, 0);
      }
    }
  }, [user, user?.mustChangePassword, passwordChangePrompt, isProvider, clearPasswordChangePrompt]);

  const handleSubmit = () => {
    setChangeError(null);
    if (nextPassword.length < 8) {
      setChangeError('Password must be at least 8 characters.');
      return;
    }
    if (nextPassword !== confirmPassword) {
      setChangeError('Passwords do not match.');
      return;
    }
    setChangeBusy(true);
    void changePasswordWithApi(nextPassword)
      .then(async () => {
        await refreshProfile();
        clearPasswordChangePrompt();
        setSheetOpen(false);
        setNextPassword('');
        setConfirmPassword('');
        optionalAlertShownRef.current = false;
      })
      .catch((e) => setChangeError(formatAuthError(e)))
      .finally(() => setChangeBusy(false));
  };

  const closeOptional = () => {
    if (mandatory || user?.mustChangePassword) return;
    setSheetOpen(false);
    clearPasswordChangePrompt();
  };

  if (!user) return null;

  return (
    <Modal
      visible={sheetOpen}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (mandatory || user.mustChangePassword) return;
        closeOptional();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {!(mandatory || user.mustChangePassword) && (
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={closeOptional}
              accessibilityLabel="Close"
            >
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Change password</Text>
          <Text style={styles.subtitle}>
            {mandatory || user.mustChangePassword
              ? 'You signed in with a one-time password. Set a new password to continue.'
              : 'Choose a new password for your account.'}
          </Text>

          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="New password"
              placeholderTextColor={colors.textSecondary}
              value={nextPassword}
              onChangeText={setNextPassword}
              secureTextEntry={!showNextPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowNextPassword((v) => !v)}
              accessibilityLabel={showNextPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showNextPassword ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirmPassword((v) => !v)}
              accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {changeError ? <Text style={styles.error}>{changeError}</Text> : null}

          {changeBusy ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : (
            <PrimaryButton title="Update password" onPress={handleSubmit} />
          )}

          {(mandatory || user.mustChangePassword) && (
            <TouchableOpacity
              style={styles.signOutRow}
              onPress={() => void signOutUser()}
              activeOpacity={0.7}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
