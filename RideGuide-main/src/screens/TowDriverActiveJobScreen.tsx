import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { ServiceRequest } from '../backend/types';
import { listServiceRequests, subscribeRequestById, updateServiceRequest } from '../backend/serviceRequestsService';
import { updateUserProfile } from '../backend/userProfileService';
import { extractApiError } from '../backend/apiClient';
import { useUserRole } from '../context/UserRoleContext';
import { useAuth } from '../context/AuthContext';
import { useOngoingActivity } from '../context/OngoingActivityContext';

const NEXT_STATUS: Record<string, 'driver_picked_hire' | 'driver_on_the_way' | 'driver_arrived' | 'vehicle_in_tow' | 'completed' | null> = {
  requested: 'driver_picked_hire',
  driver_picked_hire: 'driver_on_the_way',
  driver_on_the_way: 'driver_arrived',
  driver_arrived: 'vehicle_in_tow',
  vehicle_in_tow: 'completed',
  completed: null,
  cancelled: null,
  accepted: 'driver_on_the_way',
  pending: null,
};

const LABELS: Record<string, string> = {
  driver_picked_hire: 'Mark picked up hire',
  driver_on_the_way: 'Mark on the way',
  driver_arrived: 'Mark arrived',
  vehicle_in_tow: 'Mark vehicle in tow',
  completed: 'Mark completed',
};
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';
const MAP_TILE_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = MAPBOX_TOKEN ? '© Mapbox © OpenStreetMap contributors' : '© OpenStreetMap contributors';

interface TowDriverActiveJobScreenProps {
  requestId: string;
  onMinimize?: () => void;
  onDone: () => void;
}

export const TowDriverActiveJobScreen: React.FC<TowDriverActiveJobScreenProps> = ({ requestId, onMinimize, onDone }) => {
  const { spacing, fontSizes, borderRadius } = useResponsive();
  const { role } = useUserRole();
  const { user } = useAuth();
  const { syncFromServiceRequest } = useOngoingActivity();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRedirectedRef = useRef(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastLocationPatchAtRef = useRef(0);

  const scheduleDoneOnce = () => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
    completionTimeoutRef.current = setTimeout(onDone, 1400);
  };

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
      hasRedirectedRef.current = false;
    };
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  useEffect(() => {
    if (role !== 'tow') onDone();
  }, [onDone, role]);

  useEffect(() => {
    let cancelled = false;

    const stopWatch = () => {
      watchRef.current?.remove();
      watchRef.current = null;
    };

    const syncLocationToServer = async (
      latitude: number,
      longitude: number,
      options?: { force?: boolean }
    ) => {
      const now = Date.now();
      if (!options?.force && now - lastLocationPatchAtRef.current < 5000) return;
      lastLocationPatchAtRef.current = now;
      try {
        await updateUserProfile({ location: { lat: latitude, lng: longitude } });
      } catch {
        // non-fatal: job UI should continue even when location patch fails
      }
    };

    void (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (cancelled || perm.status !== 'granted') return;

      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          await syncLocationToServer(current.coords.latitude, current.coords.longitude, { force: true });
        }
      } catch {
        // ignore one-shot GPS failures
      }

      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          (pos) => {
            if (cancelled) return;
            void syncLocationToServer(pos.coords.latitude, pos.coords.longitude);
          }
        );
        if (cancelled) {
          sub.remove();
          return;
        }
        watchRef.current = sub;
      } catch {
        // ignore watch failures; manual status GPS push still exists
      }
    })();

    return () => {
      cancelled = true;
      stopWatch();
    };
  }, []);

  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    (async () => {
      try {
        const items = await listServiceRequests();
        if (alive) setRequest(items.find((item) => item._id === requestId) ?? null);
        off = await subscribeRequestById(requestId, (doc) => {
          setRequest(doc);
          if (doc.status === 'completed') scheduleDoneOnce();
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; off?.(); };
  }, [onDone, requestId]);

  useEffect(() => {
    if (!request || !user || user.role !== 'tow') return;
    syncFromServiceRequest(request, user.role);
  }, [request, syncFromServiceRequest, user]);

  const nextStatus = request ? NEXT_STATUS[request.status] : null;

  const mapHtml = useMemo(() => {
    const lat = request?.pickupLatitude ?? request?.latitude ?? 6.9271;
    const lng = request?.pickupLongitude ?? request?.longitude ?? 79.8612;
    const dropLat = request?.dropoffLatitude ?? lat + 0.01;
    const dropLng = request?.dropoffLongitude ?? lng + 0.01;
    return `
      <!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>html,body,#map{height:100%;margin:0;}</style></head>
      <body><div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const map=L.map('map').fitBounds([[${lat},${lng}],[${dropLat},${dropLng}]]);
        L.tileLayer('${MAP_TILE_URL}',{maxZoom:19, attribution:'${MAP_ATTRIBUTION}'}).addTo(map);
        L.marker([${lat},${lng}]).addTo(map).bindPopup('Pickup');
        L.marker([${dropLat},${dropLng}]).addTo(map).bindPopup('Dropoff');
        L.polyline([[${lat},${lng}],[${dropLat},${dropLng}]],{color:'#2563EB'}).addTo(map);
      </script></body></html>
    `;
  }, [request]);

  const onAdvanceStatus = async () => {
    if (!request || !nextStatus) return;
    setSaving(true);
    try {
      let canUseGps = false;
      try {
        const perm = await Promise.race([
          Location.requestForegroundPermissionsAsync(),
          new Promise<{ status: 'denied' }>((resolve) => setTimeout(() => resolve({ status: 'denied' }), 2500)),
        ]);
        canUseGps = perm.status === 'granted';
      } catch {
        canUseGps = false;
      }

      if (canUseGps) {
        try {
          const pos = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
          ]);
          if (pos) {
            await updateUserProfile({
              location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            });
          }
        } catch {
          // Do not block status transition when GPS fetch fails.
        }
      }

      const updated = await updateServiceRequest(request._id, nextStatus);
      if (nextStatus === 'vehicle_in_tow' && canUseGps) {
        try {
          const posAfter = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
          ]);
          if (posAfter) {
            await updateUserProfile({
              location: { lat: posAfter.coords.latitude, lng: posAfter.coords.longitude },
            });
          }
        } catch {
          // non-fatal
        }
      }
      setRequest(updated);
      if (updated.status === 'completed') scheduleDoneOnce();
    } catch (error) {
      alert(extractApiError(error, 'Failed to update status'));
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    map: { height: '52%' },
    panel: { margin: spacing.lg, marginTop: spacing.md, padding: spacing.lg, backgroundColor: colors.card, borderRadius: borderRadius.lg },
    title: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
    subtitle: { color: colors.textSecondary, marginBottom: spacing.md },
    amount: { fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
    nextBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
    nextBtnText: { color: '#fff', fontWeight: '700' },
    statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: borderRadius.full, backgroundColor: 'rgba(37,99,235,0.12)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    statusText: { marginLeft: spacing.xs, color: colors.primary, fontWeight: '600' },
    topActions: { position: 'absolute', top: spacing.lg, left: spacing.lg, zIndex: 10 },
    minimizeBtn: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
    },
    minimizeText: { marginLeft: spacing.xs, color: colors.text, fontSize: fontSizes.xs, fontWeight: '600' },
  }), [borderRadius.full, borderRadius.lg, borderRadius.md, fontSizes.lg, spacing.lg, spacing.md, spacing.sm, spacing.xs]);

  if (loading || !request) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView source={{ html: mapHtml }} style={styles.map} />
      <View style={styles.topActions}>
        <TouchableOpacity
          style={styles.minimizeBtn}
          onPress={() => {
            if (request && user?.role === 'tow') syncFromServiceRequest(request, user.role);
            onMinimize?.();
          }}
          activeOpacity={0.85}
        >
          <Icon name="chevron-back" size={16} color={colors.primary} />
          <Text style={styles.minimizeText}>Continue in background</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.panel}>
        <Text style={styles.title}>Tow active job</Text>
        <Text style={styles.subtitle}>{request.userName} · {request.vehicle}</Text>
        <Animated.View style={[styles.statusPill, { transform: [{ scale: pulse }] }]}>
          <Icon name="navigate" size={16} color={colors.primary} />
          <Text style={styles.statusText}>{request.status.replaceAll('_', ' ')}</Text>
        </Animated.View>
        <Text style={styles.amount}>Estimated fare: {request.currency ?? 'LKR'} {Math.round(request.estimatedAmount ?? 0)}</Text>
        {nextStatus ? (
          <TouchableOpacity disabled={saving} style={styles.nextBtn} onPress={onAdvanceStatus} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>{saving ? 'Updating...' : (LABELS[nextStatus] ?? 'Next status')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={onDone} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Back to dashboard</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
