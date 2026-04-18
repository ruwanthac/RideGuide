import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, shadows } from '../constants/theme';
import { useResponsive } from '../hooks';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const { spacing, borderRadius, fontSizes, buttonHeight } = useResponsive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          backgroundColor: colors.primary,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: borderRadius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: buttonHeight,
          ...shadows.md,
        },
        buttonDisabled: {
          opacity: 0.6,
        },
        text: {
          color: colors.card,
          fontSize: fontSizes.md,
          fontWeight: '600',
        },
      }),
    [spacing, borderRadius, fontSizes, buttonHeight]
  );

  return (
    <TouchableOpacity
      style={[
        styles.button,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={colors.card} size="small" />
      ) : (
        <Text style={StyleSheet.flatten([styles.text, textStyle])}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};
