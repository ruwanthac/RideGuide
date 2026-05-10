import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, Switch, Animated, Easing, Platform } from 'react-native';
import * as Location from 'expo-location';
import { Card } from '../';
import { colors } from '../../constants/theme';
import { useResponsive } from '../../hooks';
import { updateUserProfile } from '../../backend/userProfileService';
import { fetchMe } from '../../backend/authService';
import { listServiceRequests } from '../../backend/serviceRequestsService';
import type { ServiceRequest } from '../../backend/types';
import { useAuth } from '../../context/AuthContext';

interface TowDashboardProps {
  driverName?: string;
}

const LOCATION_PATCH_MIN_MS = 45_000;
const METRICS_POLL_MS = 45_000;
const COMPLETED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function isActiveTowForDriver(r: ServiceRequest, userId: string): boolean {
  if (r.type !== 'tow') return false;
  if (!r.acceptedBy || String(r.acceptedBy) !== String(userId)) return false;
  return r.status !== 'completed' && r.status !== 'cancelled';
}

function buildGeocodeLabel(results: Location.LocationGeocodedAddress[]): string {
  const g = results[0];
  if (!g) return '';
  const parts = [g.name, g.street, g.district, g.city, g.subregion, g.region]
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim());
  const uniq = [...new Set(parts)];
  return uniq.slice(0, 4).join(' · ');
}

function verificationCopy(status: string | undefined, company: string) {
  if (status === 'pending') {
    return {
      title: 'Verification pending',
      detail:
        'Your company and truck documents are under review. You cannot sign in until approved; you will receive an email with a one-time password when approved.',
      tone: 'warn' as const,
    };
  }
  if (status === 'rejected') {
    return {
      title: 'Verification not approved',
      detail: 'Your tow provider application was rejected. Contact support if you need help.',
      tone: 'bad' as const,
    };
  }
  return {
    title: 'Profile',
    detail: `Company and truck details are on file for “${company}”. Use availability to go live for requests.`,
    tone: 'ok' as const,
  };
}

export const TowDashboard: React.FC<TowDashboardProps> = ({ driverName }) => {
  const { user } = useAuth();
  const { spacing, fontSizes, borderRadius, scale } = useResponsive();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [activeRequestsCount, setActiveRequestsCount] = useState(0);
  const [completedJobs30Count, setCompletedJobs30Count] = useState(0);
  const [isAvailable, setIsAvailable] = useState(true);

  const [liveLocationLabel, setLiveLocationLabel] = useState<string>(
    'Turn on availability to share live GPS with the network.',
  );
  const [liveCoordsText, setLiveCoordsText] = useState<string | null>(null);
  const [locationPermissionHint, setLocationPermissionHint] = useState<string | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastServerPatchAt = useRef(0);
  const hasSentLocationOnce = useRef(false);

  const companyLabel = user?.businessName?.trim() || 'Your company';
  const pvStatus = user?.providerVerificationStatus;
  const v = verificationCopy(pvStatus, companyLabel);

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
        statusBlock: {
          flex: 1,
          marginRight: spacing.md,
        },
        statusTitle: {
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.text,
        },
        statusSubtitle: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 2,
        },
        availabilityPill: {
          marginTop: spacing.sm,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(37,99,235,0.08)',
        },
        availabilityPillText: {
          fontSize: fontSizes.xs,
          color: colors.primary,
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
        locationRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        locationLabelBlock: {
          flex: 1,
        },
        locationLabel: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
        },
        locationValue: {
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.text,
          marginTop: 2,
        },
        locationPermissionError: {
          fontSize: fontSizes.xs,
          color: colors.error,
          marginTop: spacing.sm,
        },
        locationStatusDot: {
          width: scale(10),
          height: scale(10),
          borderRadius: borderRadius.full,
          backgroundColor: colors.success,
          marginLeft: spacing.sm,
        },
        subtleDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginVertical: spacing.md,
        },
        hintText: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
        },
        profileTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.xs,
        },
        profileLine: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: spacing.xs,
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

  const loadTowMetrics = useCallback(async () => {
    const uid = user?._id;
    if (!uid) {
      setActiveRequestsCount(0);
      setCompletedJobs30Count(0);
      return;
    }
    try {
      const [live, history] = await Promise.all([listServiceRequests(), listServiceRequests({ history: true })]);
      const active = live.filter((r) => isActiveTowForDriver(r, uid));
      setActiveRequestsCount(active.length);

      const cutoff = Date.now() - COMPLETED_WINDOW_MS;
      const completed30 = history.filter(
        (r) =>
          r.type === 'tow' &&
          r.status === 'completed' &&
          new Date(r.updatedAt ?? r.createdAt).getTime() >= cutoff,
      );
      setCompletedJobs30Count(completed30.length);
    } catch {
      setActiveRequestsCount(0);
      setCompletedJobs30Count(0);
    }
  }, [user?._id]);

  useFocusEffect(
    useCallback(() => {
      void loadTowMetrics();
      const id = setInterval(() => void loadTowMetrics(), METRICS_POLL_MS);
      return () => clearInterval(id);
    }, [loadTowMetrics]),
  );

  useEffect(() => {
    void loadTowMetrics();
  }, [isAvailable, loadTowMetrics]);

  useEffect(() => {
    let cancelled = false;

    const stopWatch = () => {
      watchRef.current?.remove();
      watchRef.current = null;
    };

    const applyServerLocation = async (coords: { latitude: number; longitude: number }) => {
      setLiveCoordsText(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
      try {
        const geo = await Location.reverseGeocodeAsync(coords);
        const built = buildGeocodeLabel(geo);
        if (!cancelled) setLiveLocationLabel(built || 'Current location updated');
      } catch {
        if (!cancelled) setLiveLocationLabel('Current location updated');
      }
    };

    const syncLocationToServer = async (lat: number, lng: number) => {
      const now = Date.now();
      const first = !hasSentLocationOnce.current;
      if (!first && now - lastServerPatchAt.current < LOCATION_PATCH_MIN_MS) return;
      hasSentLocationOnce.current = true;
      lastServerPatchAt.current = now;
      try {
        const updated = await updateUserProfile({ location: { lat, lng } });
        const serverCoords = updated.location?.coordinates;
        if (Array.isArray(serverCoords) && serverCoords.length === 2) {
          const [serverLng, serverLat] = serverCoords;
          if (typeof serverLat === 'number' && typeof serverLng === 'number' && !cancelled) {
            void applyServerLocation({ latitude: serverLat, longitude: serverLng });
          }
        }
      } catch {
        /* non-fatal */
      }
    };

    void (async () => {
      if (!isAvailable) {
        stopWatch();
        hasSentLocationOnce.current = false;
        lastServerPatchAt.current = 0;
        if (!cancelled) {
          setLiveLocationLabel('Offline — live location not shared');
          setLiveCoordsText(null);
          setLocationPermissionHint(null);
        }
        try {
          await updateUserProfile({ location: null });
        } catch {
          /* ignore */
        }
        return;
      }

      if (!cancelled) {
        setLiveLocationLabel('Getting current location…');
        setLiveCoordsText(null);
        setLocationPermissionHint(null);
      }

      try {
        const me = await fetchMe();
        const serverCoords = me?.location?.coordinates;
        if (!cancelled && Array.isArray(serverCoords) && serverCoords.length === 2) {
          const [lng, lat] = serverCoords;
          if (typeof lat === 'number' && typeof lng === 'number') {
            await applyServerLocation({ latitude: lat, longitude: lng });
          }
        }
      } catch {
        /* ignore */
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || !isAvailable) return;

      if (status !== 'granted') {
        if (!cancelled) {
          setLocationPermissionHint(
            Platform.OS === 'web'
              ? 'Allow location for this site in the browser to share live GPS.'
              : 'Allow location access in system settings to share your live position.',
          );
          setLiveLocationLabel('Location permission needed');
        }
        return;
      }

      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10_000,
            distanceInterval: 40,
          },
          (pos) => {
            if (cancelled) return;
            const { latitude, longitude, accuracy } = pos.coords;
            setLiveCoordsText(
              `${latitude.toFixed(5)}, ${longitude.toFixed(5)}${
                accuracy != null ? ` · ±${Math.round(accuracy)} m` : ''
              }`,
            );
            void syncLocationToServer(latitude, longitude);

            void (async () => {
              let label = 'Current location updated';
              try {
                const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
                const built = buildGeocodeLabel(geo);
                if (built) label = built;
              } catch {
                /* keep generic */
              }
              if (!cancelled) setLiveLocationLabel(label);
            })();
          },
        );
        if (cancelled) {
          sub.remove();
          return;
        }
        watchRef.current = sub;
      } catch {
        if (!cancelled) {
          setLiveLocationLabel('Unable to start live location');
          setLocationPermissionHint('Enable GPS and try toggling availability off and on.');
        }
      }
    })();

    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [isAvailable]);

  const badgeColors =
    v.tone === 'warn'
      ? { bg: 'rgba(245,158,11,0.16)', fg: '#B45309' }
      : v.tone === 'bad'
      ? { bg: 'rgba(239,68,68,0.12)', fg: colors.error }
      : { bg: 'rgba(16,185,129,0.12)', fg: colors.success };

  const switchTrack = { false: 'rgba(156,163,175,0.32)', true: 'rgba(37,99,235,0.32)' } as const;
  const switchThumb = { false: '#FFFFFF', true: colors.primary } as const;

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
      <Text style={styles.sectionTitle}>Tow Dashboard</Text>

      <Card style={{ marginBottom: spacing.md }} padded>
        <View style={styles.row}>
          <View style={styles.statusBlock}>
            <Text style={styles.statusTitle}>{driverName || 'You are live'}</Text>
            <Text style={styles.statusSubtitle}>Control your availability for new tow requests.</Text>
            <View style={styles.availabilityPill}>
              <Text style={styles.availabilityPillText}>
                {isAvailable ? 'Live · visible to nearby drivers' : 'Offline · not visible to drivers'}
              </Text>
            </View>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={setIsAvailable}
            trackColor={switchTrack}
            thumbColor={isAvailable ? switchThumb.true : switchThumb.false}
          />
        </View>
      </Card>

      <Card style={{ marginBottom: spacing.md }} padded>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Active requests</Text>
            <Text style={styles.metricValue}>{activeRequestsCount}</Text>
            <Text style={styles.metricCaption}>Assigned to you</Text>
          </View>
          <View style={styles.metricSpacer} />
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Completed jobs</Text>
            <Text style={styles.metricValue}>{completedJobs30Count}</Text>
            <Text style={styles.metricCaption}>Last 30 days</Text>
          </View>
        </View>
      </Card>

      <Card padded>
        <View style={styles.locationRow}>
          <View style={styles.locationLabelBlock}>
            <Text style={styles.locationLabel}>Current location status</Text>
            <Text style={styles.locationValue}>{liveLocationLabel}</Text>
            {locationPermissionHint ? (
              <Text style={styles.locationPermissionError}>{locationPermissionHint}</Text>
            ) : null}
          </View>
          <View
            style={[
              styles.locationStatusDot,
              {
                backgroundColor: !isAvailable
                  ? colors.textSecondary
                  : locationPermissionHint
                  ? colors.error
                  : liveCoordsText
                  ? colors.success
                  : '#F59E0B',
              },
            ]}
          />
        </View>
        <View style={styles.subtleDivider} />
        <Text style={styles.hintText}>
          Your live location updates while available so nearby requests can find you.
        </Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }} padded>
        <Text style={styles.profileTitle}>{v.title}</Text>
        <Text style={styles.profileLine}>
          <Text style={{ fontWeight: '600', color: colors.text }}>Company: </Text>
          {user?.businessName || '—'}
        </Text>
        <Text style={styles.profileLine}>
          <Text style={{ fontWeight: '600', color: colors.text }}>Truck: </Text>
          {user?.truckName || '—'}
          {user?.plateNumber ? ` · ${user.plateNumber}` : ''}
        </Text>
        <Text style={[styles.profileLine, { marginTop: spacing.sm }]}>{v.detail}</Text>
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
