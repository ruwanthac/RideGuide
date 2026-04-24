import React, { useEffect, useMemo, useRef } from 'react';
import {
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { colors } from '../../constants/theme';
import { useResponsive } from '../../hooks';

interface OwnerDashboardProps {
  vehicleName?: string;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ vehicleName }) => {
  const { spacing, fontSizes } = useResponsive();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginBottom: spacing.lg,
        },
        sectionTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.xs,
        },
        sectionSubtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginBottom: spacing.md,
        },
      }),
    [fontSizes, spacing]
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.sectionTitle}>Owner Dashboard</Text>
      <Text style={styles.sectionSubtitle}>
        {vehicleName || 'Your vehicle'}
      </Text>
    </Animated.View>
  );
};

