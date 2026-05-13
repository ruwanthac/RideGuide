import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, Switch, Animated, Easing, Alert } from 'react-native';
import { Card } from '../';
import { colors } from '../../constants/theme';
import { useResponsive } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { listServiceRequests, subscribeServiceRequests } from '../../backend/serviceRequestsService';
import { updateUserProfile } from '../../backend/userProfileService';
import { extractApiError } from '../../backend/apiClient';

interface MechanicDashboardProps {
  shopName?: string;
}

function countRoadsideCompletedThisMonth(
  rows: { type: string; status: string; acceptedBy?: string | null; updatedAt: string }[],
  mechanicUserId: string,
): number {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return rows.filter((r) => {
    if (r.type !== 'roadside' || r.status !== 'completed') return false;
    if (String(r.acceptedBy ?? '') !== String(mechanicUserId)) return false;
    const d = new Date(r.updatedAt);
    return d.getFullYear() === y && d.getMonth() === m;
  }).length;
}

function verificationCopy(
  status: string | undefined,
  workshopLabel: string,
): { title: string; detail: string; tone: 'neutral' | 'warn' | 'bad' | 'ok' } {
  if (status === 'pending') {
    return {
      title: 'Verification pending',
      detail:
        'An administrator is reviewing your workshop documents. You cannot sign in until approved; watch for an email with your one-time password.',
      tone: 'warn',
    };
  }
  if (status === 'rejected') {
    return {
      title: 'Verification not approved',
      detail: 'Your provider application was rejected. Contact support if you need help.',
      tone: 'bad',
    };
  }
  return {
    title: 'Verification',
    detail: `Your workshop (“${workshopLabel}”) is verified. Availability below controls whether you receive new roadside requests.`,
    tone: 'ok',
  };
}

export const MechanicDashboard: React.FC<MechanicDashboardProps> = ({ shopName }) => {
  const { user, refreshProfile } = useAuth();
  const { spacing, fontSizes, borderRadius, scale } = useResponsive();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [incomingPendingCount, setIncomingPendingCount] = useState(0);
  const [monthlyCompletedCount, setMonthlyCompletedCount] = useState(0);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);

  const workshopLabel = user?.businessName?.trim() || shopName || 'Your workshop';
  const pvStatus = user?.providerVerificationStatus;
  const v = verificationCopy(pvStatus, workshopLabel);

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        verifyTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.xs,
        },
        verifyDetail: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          lineHeight: scale(20),
        },
        verifyBadge: {
          marginTop: spacing.sm,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs / 2,
          borderRadius: borderRadius.full,
        },
        verifyBadgeText: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
        },
      }),
    [borderRadius, fontSizes, scale, spacing],
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const refreshMonthlyCompleted = useCallback(async () => {
    const uid = user?._id;
    if (!uid) {
      setMonthlyCompletedCount(0);
      return;
    }
    try {
      const rows = await listServiceRequests({ history: true });
      setMonthlyCompletedCount(countRoadsideCompletedThisMonth(rows, uid));
    } catch {
      /* keep last value */
    }
  }, [user?._id]);

  useFocusEffect(
    useCallback(() => {
      void refreshMonthlyCompleted();
    }, [refreshMonthlyCompleted]),
  );

  useEffect(() => {
    if (!user?._id) {
      setIncomingPendingCount(0);
      return;
    }
    let alive = true;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const off = await subscribeServiceRequests(
          (items) => {
            if (!alive) return;
            setIncomingPendingCount(items.filter((r) => r.status === 'pending' && !r.acceptedBy).length);
          },
          {
            type: 'roadside',
            inboxOnly: true,
            providerOpenPoolOnly: true,
          },
        );
        unsub = off;
      } catch {
        if (alive) setIncomingPendingCount(0);
      }
    })();
    return () => {
      alive = false;
      unsub?.();
    };
  }, [user?._id]);

  const mechanicReceiving = user?.mechanicAvailable !== false;

  const onMechanicAvailabilityChange = async (next: boolean) => {
    if (!user?._id || availabilityBusy) return;
    setAvailabilityBusy(true);
    try {
      await updateUserProfile({ mechanicAvailable: next });
      await refreshProfile();
    } catch (e) {
      Alert.alert('Could not update availability', extractApiError(e, 'Please try again.'));
    } finally {
      setAvailabilityBusy(false);
    }
  };

  const badgeColors =
    v.tone === 'warn'
      ? { bg: 'rgba(245,158,11,0.16)', fg: '#B45309' }
      : v.tone === 'bad'
      ? { bg: 'rgba(239,68,68,0.12)', fg: colors.error }
      : v.tone === 'ok'
      ? { bg: 'rgba(16,185,129,0.12)', fg: colors.success }
      : { bg: 'rgba(107,114,128,0.12)', fg: colors.textSecondary };

  const switchTrack = { false: 'rgba(156,163,175,0.32)', true: 'rgba(34,197,94,0.32)' } as const;
  const switchThumb = { false: '#FFFFFF', true: colors.success } as const;

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
            <Text style={styles.statusLabel}>{workshopLabel}</Text>
            <Text style={styles.statusSubLabel}>Control your availability for new jobs.</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {mechanicReceiving
                  ? 'Online · visible to owners · receiving new requests'
                  : 'Offline · not receiving new requests'}
              </Text>
            </View>
          </View>
          <Switch
            value={mechanicReceiving}
            disabled={availabilityBusy}
            trackColor={switchTrack}
            thumbColor={mechanicReceiving ? switchThumb.true : switchThumb.false}
            onValueChange={(val) => {
              void onMechanicAvailabilityChange(val);
            }}
          />
        </View>
      </Card>

      <Card style={{ marginBottom: spacing.md }} padded>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Incoming requests</Text>
            <Text style={styles.metricValue}>{incomingPendingCount}</Text>
            <Text style={styles.metricCaption}>Waiting for your response</Text>
          </View>
          <View style={styles.metricSpacer} />
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Jobs this month</Text>
            <Text style={styles.metricValue}>{monthlyCompletedCount}</Text>
            <Text style={styles.metricCaption}>Completed jobs</Text>
          </View>
        </View>
      </Card>

      <Card padded>
        <Text style={styles.verifyTitle}>{v.title}</Text>
        <Text style={styles.verifyDetail}>{v.detail}</Text>
        <View style={[styles.verifyBadge, { backgroundColor: badgeColors.bg }]}>
          <Text style={[styles.verifyBadgeText, { color: badgeColors.fg }]}>
            {pvStatus === 'pending'
              ? 'Pending review'
              : pvStatus === 'rejected'
              ? 'Rejected'
              : pvStatus === 'approved'
              ? 'Approved'
              : 'Active'}
          </Text>
        </View>
      </Card>
    </Animated.View>
  );
};
