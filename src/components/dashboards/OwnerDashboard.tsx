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

const DUMMY_HEALTH_SCORE = 82;
const DUMMY_RECENT_DIAGNOSES = [
  { id: '1', title: 'Engine Check', status: 'Resolved', time: '2 days ago' },
  { id: '2', title: 'Battery Health', status: 'Monitoring', time: '1 week ago' },
  { id: '3', title: 'Brake Inspection', status: 'Resolved', time: '2 weeks ago' },
];

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ vehicleName }) => {
  const { spacing, fontSizes, borderRadius, iconSizes, scale } = useResponsive();
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

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
        },
        healthCardContent: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        healthCircleWrapper: {
          width: scale(80),
          height: scale(80),
          borderRadius: scale(40),
          borderWidth: 6,
          borderColor: 'rgba(37, 99, 235, 0.16)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
        },
        healthCircleInner: {
          width: scale(64),
          height: scale(64),
          borderRadius: scale(32),
          backgroundColor: 'rgba(37, 99, 235, 0.05)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        healthScoreText: {
          fontSize: fontSizes.xxl,
          fontWeight: '700',
          color: colors.primary,
        },
        healthScoreLabel: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 2,
        },
        healthMeta: {
          flex: 1,
        },
        healthMetaTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
        },
        healthMetaSubtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: 4,
        },
        healthMetaTag: {
          marginTop: spacing.sm,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.xl,
          backgroundColor: 'rgba(5, 150, 105, 0.08)',
        },
        healthMetaTagText: {
          fontSize: fontSizes.xs,
          color: colors.success,
          fontWeight: '500',
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
        sectionHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        },
        sectionHeaderTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
        },
        sectionHeaderLink: {
          fontSize: fontSizes.sm,
          color: colors.primary,
        },
        diagnosesList: {},
        diagnosisItem: {
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        diagnosisItemLast: {
          borderBottomWidth: 0,
        },
        diagnosisTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        diagnosisTitle: {
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.text,
        },
        diagnosisStatus: {
          fontSize: fontSizes.xs,
          fontWeight: '500',
          color: colors.success,
        },
        diagnosisMeta: {
          marginTop: 2,
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
        },
      }),
    [borderRadius, fontSizes, iconSizes, scale, spacing]
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: DUMMY_HEALTH_SCORE,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [fadeAnim, progressAnim]);

  const interpolatedBorderColor = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['rgba(239, 68, 68, 0.4)', 'rgba(22, 163, 74, 0.45)'],
  });

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

      <Card style={{ marginBottom: spacing.md }} padded>
        <View style={styles.healthCardContent}>
          <Animated.View
            style={[
              styles.healthCircleWrapper,
              { borderColor: interpolatedBorderColor },
            ]}
          >
            <View style={styles.healthCircleInner}>
              <Text style={styles.healthScoreText}>
                {Math.round(DUMMY_HEALTH_SCORE)}
              </Text>
              <Text style={styles.healthScoreLabel}>Health</Text>
            </View>
          </Animated.View>

          <View style={styles.healthMeta}>
            <Text style={styles.healthMetaTitle}>
              {vehicleName || 'Primary vehicle'}
            </Text>
            <Text style={styles.healthMetaSubtitle}>
              Overall condition looks good. No critical issues detected.
            </Text>
            <View style={styles.healthMetaTag}>
              <Text style={styles.healthMetaTagText}>Safe to drive</Text>
            </View>
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
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Recent diagnoses</Text>
          <Text style={styles.sectionHeaderLink}>View all</Text>
        </View>

        <View style={styles.diagnosesList}>
          {DUMMY_RECENT_DIAGNOSES.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.diagnosisItem,
                index === DUMMY_RECENT_DIAGNOSES.length - 1 &&
                  styles.diagnosisItemLast,
              ]}
            >
              <View style={styles.diagnosisTitleRow}>
                <Text style={styles.diagnosisTitle}>{item.title}</Text>
                <Text style={styles.diagnosisStatus}>{item.status}</Text>
              </View>
              <Text style={styles.diagnosisMeta}>{item.time}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
};

