import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBackPress,
  rightAction,
  style,
}) => {
  const { spacing, fontSizes, iconSizes } = useResponsive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
        },
        leftSection: {
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
        },
        backButton: {
          padding: spacing.sm,
          marginRight: spacing.sm,
        },
        backIcon: {
          fontSize: iconSizes.md,
          color: colors.primary,
          fontWeight: '600',
        },
        title: {
          fontSize: fontSizes.xl,
          fontWeight: '600',
          color: colors.text,
          flex: 1,
        },
        rightSection: {
          marginLeft: spacing.sm,
        },
      }),
    [spacing, fontSizes, iconSizes]
  );

  return (
    <View style={[styles.header, style]}>
      <View style={styles.leftSection}>
        {showBack && onBackPress ? (
          <TouchableOpacity
            onPress={onBackPress}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      {rightAction ? (
        <View style={styles.rightSection}>{rightAction}</View>
      ) : null}
    </View>
  );
};
