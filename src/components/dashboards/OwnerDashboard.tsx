import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../Card';
import { colors } from '../../constants/theme';
import { useResponsive } from '../../hooks';
import { Icon } from '../Icon';

interface OwnerDashboardProps {
  vehicleName?: string;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ vehicleName }) => {
  const { spacing, fontSizes, borderRadius, iconSizes } = useResponsive();
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
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
        activitiesButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.primary,
          borderRadius: borderRadius.lg,
        },
        activitiesButtonText: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: '#FFFFFF',
          marginLeft: spacing.sm,
        },
      }),
    [borderRadius, fontSizes, iconSizes, spacing]
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

      <Card style={{ marginBottom: spacing.md }} padded>
        <TouchableOpacity
          style={styles.activitiesButton}
          onPress={() => navigation.navigate('Activities')}
          activeOpacity={0.8}
        >
          <Icon name="document-text" size={iconSizes.md} color="#FFFFFF" />
          <Text style={styles.activitiesButtonText}>Your activities</Text>
        </TouchableOpacity>
      </Card>
    </Animated.View>
  );
};

