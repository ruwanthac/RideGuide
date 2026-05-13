import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type ViewProps,
} from 'react-native';
import { colors, shadows } from '../constants/theme';
import { useResponsive } from '../hooks';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  padded = true,
  ...rest
}) => {
  const { spacing, borderRadius } = useResponsive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        touchable: { borderRadius: borderRadius.lg },
        wrapper: { borderRadius: borderRadius.lg },
        card: {
          backgroundColor: colors.card,
          borderRadius: borderRadius.lg,
          ...shadows.md,
        },
        padded: { padding: spacing.lg },
      }),
    [spacing, borderRadius]
  );

  const content = (
    <View style={[styles.card, padded && styles.padded]} {...rest}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.touchable, style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.wrapper, style]}>{content}</View>;
};
