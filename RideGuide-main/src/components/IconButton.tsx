import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { colors, borderRadius, spacing } from '../constants/theme';
import type { IconName } from './Icon';

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  label?: string;
  style?: ViewStyle;
  size?: number;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  label,
  style,
  size = 48,
}) => (
  <TouchableOpacity
    style={[styles.button, { width: size, height: size }, style]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Icon name={icon} size={size * 0.5} color={colors.primary} />
    {label ? <Text style={styles.label}>{label}</Text> : null}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
