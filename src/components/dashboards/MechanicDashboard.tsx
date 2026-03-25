import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../Card';
import { colors } from '../../constants/theme';
import { useResponsive } from '../../hooks';
import { Icon } from '../Icon';

interface MechanicDashboardProps {
  shopName?: string;
}

const DUMMY_REQUESTS = 5;
const DUMMY_MONTHLY_JOBS = 32;
const DUMMY_REVENUE = 'LKR 184,000';

export const MechanicDashboard: React.FC<MechanicDashboardProps> = ({
  shopName,
}) => {
  const { spacing, fontSizes, borderRadius, scale, iconSizes } = useResponsive();
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
          marginBottom: spacing.md,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        statusLabelGroup: {
          flexDirection: 'column',
          flex: 1,
          marginRight: spacing.md,
        },
        statusLabel: {
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.text,
        },
        statusSubLabel: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 2,
        },
        statusPill: {
          marginTop: spacing.sm,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
        },
        statusPillText: {
          fontSize: fontSizes.xs,
          color: colors.success,
          fontWeight: '500',
        },
        metricRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        metricCard: {
          flex: 1,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.lg,
          backgroundColor: 'rgba(15,23,42,0.02)',
        },
        metricSpacer: {
          width: spacing.sm,
        },
        metricLabel: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
        },
        metricValue: {
          fontSize: fontSizes.xxl,
          fontWeight: '700',
          color: colors.text,
          marginTop: 2,
        },
        metricCaption: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 4,
        },
        revenueRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        revenueLabel: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
        },
        revenueValue: {
          fontSize: fontSizes.xxl,
          fontWeight: '700',
          color: colors.text,
        },
        revenueTag: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(37,99,235,0.06)',
        },
        revenueTagText: {
          fontSize: fontSizes.xs,
          color: colors.primary,
          fontWeight: '500',
        },
        subtleDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginVertical: spacing.md,
        },
        hintText: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: spacing.sm,
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
        switchTrackColor: {
          false: 'rgba(156,163,175,0.32)',
          true: 'rgba(34,197,94,0.32)',
        } as { false: string; true: string },
        switchThumbColor: {
          false: '#FFFFFF',
          true: colors.success,
        } as { false: string; true: string },
      }),
    [borderRadius, fontSizes, scale, spacing, iconSizes]
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
      style={{
        marginBottom: spacing.lg,
        opacity: fadeAnim,
        transform: [
          {
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      <Text style={styles.sectionTitle}>Mechanic Dashboard</Text>

      <Card style={{ marginBottom: spacing.md }} padded>
        <View style={styles.row}>
          <View style={styles.statusLabelGroup}>
            <Text style={styles.statusLabel}>
              {shopName || 'Your workshop'}
            </Text>
            <Text style={styles.statusSubLabel}>
              Control your availability for new jobs.
            </Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>Online · visible to owners</Text>
            </View>
          </View>
          <Switch
            value
            trackColor={styles.switchTrackColor}
            thumbColor={styles.switchThumbColor.true}
          />
        </View>
      </Card>

      <Card style={{ marginBottom: spacing.md }} padded>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Incoming requests</Text>
            <Text style={styles.metricValue}>{DUMMY_REQUESTS}</Text>
            <Text style={styles.metricCaption}>Waiting for your response</Text>
          </View>
          <View style={styles.metricSpacer} />
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Jobs this month</Text>
            <Text style={styles.metricValue}>{DUMMY_MONTHLY_JOBS}</Text>
            <Text style={styles.metricCaption}>Completed bookings</Text>
          </View>
        </View>
      </Card>

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

      <Card padded>
        <View style={styles.revenueRow}>
          <View>
            <Text style={styles.revenueLabel}>Revenue (this month)</Text>
            <Text style={styles.revenueValue}>{DUMMY_REVENUE}</Text>
          </View>
          <View style={styles.revenueTag}>
            <Text style={styles.revenueTagText}>+18% vs last month</Text>
          </View>
        </View>
        <View style={styles.subtleDivider} />
        <Text style={styles.hintText}>
          Track completed jobs and payouts in one place. Connect your billing
          to automate settlements.
        </Text>
      </Card>
    </Animated.View>
  );
};

