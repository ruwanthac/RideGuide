import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Animated,
  Easing,
  Dimensions,
  PanResponder,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { ServiceRequest } from '../backend/types';
import { listServiceRequests, subscribeRequestById, updateServiceRequest } from '../backend/serviceRequestsService';
import { extractApiError } from '../backend/apiClient';
import { updateUserProfile } from '../backend/userProfileService';
import { useUserRole } from '../context/UserRoleContext';
import { useAuth } from '../context/AuthContext';
import { useOngoingActivity } from '../context/OngoingActivityContext';

const NEXT_STATUS: Record<string, 'attending_to_location' | 'completed' | null> = {
  pending: null,
  accepted: 'attending_to_location',
  attending_to_location: 'completed',
  completed: null,
  cancelled: null,
  requested: null,
  driver_picked_hire: null,
  driver_on_the_way: null,
  driver_arrived: null,
  vehicle_in_tow: null,
};

const STATUS_PILL: Record<string, string> = {
  accepted: 'Accepted',
  attending_to_location: 'Attending to location',
  completed: 'Completed',
};

/** Label for advancing *into* the next status (same flow as previous screen). */
const NEXT_BUTTON_LABEL: Record<string, string> = {
  attending_to_location: 'Attending to location',
  completed: 'Mark completed',
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';
const MAP_TILE_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = MAPBOX_TOKEN ? '© Mapbox © OpenStreetMap contributors' : '© OpenStreetMap contributors';

const ROUTE_HIDE_NEAR_OWNER_M = 120;
const COORD_NEAR_ZERO_EPS = 1e-4;
const OWNER_PIN_FANOUT_UNDER_M = 42;
const ROAD_LINE = { color: '#111111', weight: 5, opacity: 0.92 };

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sanitizeLatLng(lat: unknown, lng: unknown): [number, number] | null {
  const la = typeof lat === 'number' ? lat : lat != null ? Number(lat) : NaN;
  const ln = typeof lng === 'number' ? lng : lng != null ? Number(lng) : NaN;
  if (
    !Number.isFinite(la) ||
    !Number.isFinite(ln) ||
    Math.abs(la) > 90 ||
    Math.abs(ln) > 180 ||
    (Math.abs(la) <= COORD_NEAR_ZERO_EPS && Math.abs(ln) <= COORD_NEAR_ZERO_EPS)
  ) {
    return null;
  }
  return [la, ln];
}

function resolveOwnerPickup(request: ServiceRequest): { lat: number; lng: number } | null {
  const candidates: ReadonlyArray<[unknown, unknown]> = [
    [request.pickupLatitude, request.pickupLongitude],
    [request.latitude, request.longitude],
    [request.requesterLiveLocation?.latitude, request.requesterLiveLocation?.longitude],
  ];
  for (const [la, ln] of candidates) {
    const pair = sanitizeLatLng(la, ln);
    if (pair) return { lat: pair[0], lng: pair[1] };
  }
  return null;
}

interface MechanicActiveJobScreenProps {
  requestId: string;
  onMinimize?: () => void;
  onDone: () => void;
  onOpenChat: (request: ServiceRequest) => void;
}

export const MechanicActiveJobScreen: React.FC<MechanicActiveJobScreenProps> = ({
  requestId,
  onMinimize,
  onDone,
  onOpenChat,
}) => {
  const insets = useSafeAreaInsets();
  const { spacing, fontSizes, borderRadius, width: windowWidth } = useResponsive();
  const { role } = useUserRole();
  const { user } = useAuth();
  const { syncFromServiceRequest } = useOngoingActivity();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mechanicLive, setMechanicLive] = useState<{ latitude: number; longitude: number } | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRedirectedRef = useRef(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastLocationPatchAtRef = useRef(0);

  const screenHeight = Dimensions.get('window').height;
  const sheetCollapsedHeight = Math.round(screenHeight * 0.26) + insets.bottom;
  const sheetExpandedHeight = Math.round(screenHeight * 0.74);
  const maxSheetTranslate = Math.max(16, sheetExpandedHeight - sheetCollapsedHeight);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetDragStartY = useRef(0);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.05,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((v) => {
            sheetDragStartY.current = typeof v === 'number' ? v : 0;
          });
        },
        onPanResponderMove: (_e, g) => {
          const next = Math.min(maxSheetTranslate, Math.max(0, sheetDragStartY.current + g.dy));
          sheetTranslateY.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          const raw = sheetDragStartY.current + g.dy;
          const mid = maxSheetTranslate / 2;
          const vy = typeof g.vy === 'number' ? g.vy : 0;
          let snap: number;
          if (vy > 0.6) snap = maxSheetTranslate;
          else if (vy < -0.6) snap = 0;
          else snap = raw > mid ? maxSheetTranslate : 0;
          Animated.spring(sheetTranslateY, {
            toValue: snap,
            useNativeDriver: false,
            friction: 8,
            tension: 65,
          }).start();
        },
      }),
    [maxSheetTranslate, sheetTranslateY],
  );

  const scheduleDoneOnce = () => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
    completionTimeoutRef.current = setTimeout(onDone, 1300);
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
    if (role !== 'mechanic') onDone();
  }, [onDone, role]);

  useEffect(() => {
    if (role !== 'mechanic') return;
    const active =
      request?.status === 'accepted' || request?.status === 'attending_to_location';
    if (!active) {
      watchRef.current?.remove();
      watchRef.current = null;
      return;
    }

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
      if (!cancelled) setMechanicLive({ latitude, longitude });
      const now = Date.now();
      if (!options?.force && now - lastLocationPatchAtRef.current < 5000) return;
      lastLocationPatchAtRef.current = now;
      try {
        await updateUserProfile({ location: { lat: latitude, lng: longitude } });
      } catch {
        /* non-fatal */
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
        /* ignore */
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
          },
        );
        if (cancelled) {
          sub.remove();
          return;
        }
        watchRef.current = sub;
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [role, request?.status, requestId]);

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
    return () => {
      alive = false;
      off?.();
    };
  }, [onDone, requestId]);

  useEffect(() => {
    if (!request || !user || user.role !== 'mechanic') return;
    syncFromServiceRequest(request, user.role);
  }, [request, syncFromServiceRequest, user]);

  const mapWebViewKey = useMemo(() => {
    if (!request) return '';
    const owner = resolveOwnerPickup(request);
    return [
      request._id,
      request.status,
      request.updatedAt ?? '',
      owner?.lat ?? '—',
      owner?.lng ?? '—',
      mechanicLive?.latitude ?? 'x',
      mechanicLive?.longitude ?? 'y',
    ].join('|');
  }, [request, mechanicLive?.latitude, mechanicLive?.longitude]);

  const mapHtml = useMemo(() => {
    if (!request) return '';

    const ownerPopup = JSON.stringify(request.pickupAddress || request.location || 'Vehicle owner');
    const fallbackCenter = { lat: 6.9271, lng: 79.8612 };
    const ownerResolved = resolveOwnerPickup(request);
    const hasOwnerCoords = !!ownerResolved;
    const ownerLat = ownerResolved?.lat ?? fallbackCenter.lat;
    const ownerLng = ownerResolved?.lng ?? fallbackCenter.lng;

    const ml = mechanicLive?.latitude;
    const mLng = mechanicLive?.longitude;
    const hasLiveMech = typeof ml === 'number' && typeof mLng === 'number';
    const accPair = sanitizeLatLng(
      request.acceptedProviderLocation?.latitude,
      request.acceptedProviderLocation?.longitude,
    );
    /** Only treat as mechanic position when GPS or enriched accept location exists — never use owner coords as fake mechanic. */
    const hasMechanicPos = hasLiveMech || !!accPair;
    const mechanicLat = hasLiveMech ? ml! : accPair ? accPair[0] : ownerLat;
    const mechanicLng = hasLiveMech ? mLng! : accPair ? accPair[1] : ownerLng;

    const st = request.status;

    /** accepted → route always (when GPS) · attending → hide black line near owner · completed → mechanic only */
    const phase: 'completed_only' | 'nav_hide_near' | 'nav_full' | 'inactive' =
      st === 'completed'
        ? 'completed_only'
        : st === 'attending_to_location'
          ? 'nav_hide_near'
          : st === 'accepted'
            ? 'nav_full'
            : 'inactive';

    const distToOwnerM =
      hasOwnerCoords && hasMechanicPos
        ? haversineMeters(mechanicLat, mechanicLng, ownerLat, ownerLng)
        : Number.POSITIVE_INFINITY;

    const showOwnerPin = hasOwnerCoords && (phase === 'nav_full' || phase === 'nav_hide_near');
    const showMechanicPin =
      phase === 'completed_only'
        ? hasMechanicPos
        : (phase === 'nav_full' || phase === 'nav_hide_near') && hasMechanicPos;

    let ownerPinLat = ownerLat;
    let ownerPinLng = ownerLng;
    if (
      hasOwnerCoords &&
      hasLiveMech &&
      showOwnerPin &&
      showMechanicPin &&
      distToOwnerM < OWNER_PIN_FANOUT_UNDER_M
    ) {
      ownerPinLat = ownerLat + 2.8e-4;
      ownerPinLng = ownerLng;
    }

    const drawBlackRoute =
      hasOwnerCoords &&
      hasLiveMech &&
      (phase === 'nav_full' ||
        (phase === 'nav_hide_near' && distToOwnerM > ROUTE_HIDE_NEAR_OWNER_M));

    const injectPhase = phase;
    const injectShowOwner = showOwnerPin;
    const injectShowMech = showMechanicPin;
    const injectDrawRoute = drawBlackRoute;
    const injectHasLiveGps = hasLiveMech;

    return `
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map { height:100%; margin:0; }
  .lbl { font-size:11px; font-weight:bold; }
</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const PHASE = '${injectPhase}';
  const ownerLat = ${ownerLat};
  const ownerLng = ${ownerLng};
  const ownerPinLat = ${ownerPinLat};
  const ownerPinLng = ${ownerPinLng};
  const mechLat = ${mechanicLat};
  const mechLng = ${mechanicLng};
  const hasLiveGps = ${injectHasLiveGps ? 'true' : 'false'};
  const showOwnerPin = ${injectShowOwner ? 'true' : 'false'};
  const showMechPin = ${injectShowMech ? 'true' : 'false'};
  const drawBlackLine = ${injectDrawRoute ? 'true' : 'false'};

  const points = [];
  if (showOwnerPin) points.push([ownerPinLat, ownerPinLng]);
  if (showMechPin) points.push([mechLat, mechLng]);

  const map = L.map('map');
  if (points.length === 0) {
    map.setView([ownerLat, ownerLng], 12);
  } else if (points.length === 1) {
    map.setView(points[0], PHASE === 'completed_only' ? 14 : 13);
  } else {
    map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
  }
  L.tileLayer('${MAP_TILE_URL}', { maxZoom: 19, attribution: 'Leaflet | ${MAP_ATTRIBUTION}' }).addTo(map);

  const ownerPinHtml =
    '<div style="background:#2563EB;color:#fff;width:34px;height:34px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);">🚗</div>';
  const mechPinHtml =
    '<div style="background:#111;color:#fff;width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);">🛠️</div>';

  if (showOwnerPin) {
    L.marker([ownerPinLat, ownerPinLng], {
      icon: L.divIcon({ className: 'own', html: ownerPinHtml, iconSize: [34, 34], iconAnchor: [17, 17] }),
    })
      .addTo(map)
      .bindPopup('<span class="lbl">Vehicle owner · ' + ${ownerPopup} + '</span>');
  }
  if (showMechPin) {
    const liveLabel = hasLiveGps ? 'You (live)' : 'Mechanic';
    L.marker([mechLat, mechLng], {
      icon: L.divIcon({ className: 'mech', html: mechPinHtml, iconSize: [40, 40], iconAnchor: [20, 20] }),
    })
      .addTo(map)
      .bindPopup('<span class="lbl">' + liveLabel + '</span>');
  }

  const lineStyle = { color: '${ROAD_LINE.color}', weight: ${ROAD_LINE.weight}, opacity: ${ROAD_LINE.opacity} };

  function drawStraight(a, b) {
    L.polyline([a, b], lineStyle).addTo(map);
  }

  function drawRoute(fromLat, fromLng, toLat, toLng) {
    if ('${MAPBOX_TOKEN}'.length > 0) {
      const url =
        'https://api.mapbox.com/directions/v5/mapbox/driving/' +
        fromLng +
        ',' +
        fromLat +
        ';' +
        toLng +
        ',' +
        toLat +
        '?geometries=geojson&overview=full&access_token=' +
        '${MAPBOX_TOKEN}';
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          const coords = data?.routes?.[0]?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length > 1) {
            const latLngs = coords
              .filter((p) => Array.isArray(p) && p.length >= 2)
              .map((p) => [p[1], p[0]]);
            if (latLngs.length > 1) {
              L.polyline(latLngs, lineStyle).addTo(map);
              return;
            }
          }
          drawStraight([fromLat, fromLng], [toLat, toLng]);
        })
        .catch(() => drawStraight([fromLat, fromLng], [toLat, toLng]));
    } else {
      drawStraight([fromLat, fromLng], [toLat, toLng]);
    }
  }

  if (drawBlackLine) {
    drawRoute(mechLat, mechLng, ownerLat, ownerLng);
  }
</script>
</body></html>
    `;
  }, [request, mechanicLive?.latitude, mechanicLive?.longitude]);

  const nextStatus = request ? NEXT_STATUS[request.status] : null;

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
            setMechanicLive({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          }
        } catch {
          /* ok */
        }
      }

      const updated = await updateServiceRequest(request._id, nextStatus);
      setRequest(updated);
      if (updated.status === 'completed') scheduleDoneOnce();
    } catch (error) {
      Alert.alert('Unable to update', extractApiError(error, 'Please try again'));
    } finally {
      setSaving(false);
    }
  };

  const onCall = () => {
    if (!request?.phoneNumber?.trim()) {
      Alert.alert('No phone number', 'This request does not have a phone number.');
      return;
    }
    void Linking.openURL(`tel:${request.phoneNumber}`);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        map: { ...StyleSheet.absoluteFillObject },
        sheet: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.card,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
          paddingBottom: Math.max(spacing.sm, insets.bottom),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 14,
          overflow: 'hidden',
        },
        sheetGrabArea: {
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          alignItems: 'center',
        },
        sheetGrabIndicator: {
          width: Math.min(160, windowWidth * 0.38),
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.border,
          marginBottom: spacing.xs,
        },
        sheetGrabHint: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          fontWeight: '600',
        },
        sheetInner: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
        },
        title: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
        subtitle: { color: colors.textSecondary, marginBottom: spacing.sm },
        statusPill: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(37,99,235,0.12)',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        },
        statusText: { marginLeft: spacing.xs, color: colors.primary, fontWeight: '600', fontSize: fontSizes.sm },
        actionsRow: { flexDirection: 'row', marginTop: spacing.md },
        iconBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.primary + '10',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.sm,
        },
        nextBtn: {
          backgroundColor: colors.primary,
          borderRadius: borderRadius.md,
          paddingVertical: spacing.md,
          alignItems: 'center',
          marginTop: spacing.md,
        },
        nextBtnText: { color: '#fff', fontWeight: '700' },
        topBar: {
          position: 'absolute',
          top: insets.top + spacing.sm,
          left: spacing.md,
          zIndex: 10,
        },
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
      }),
    [borderRadius.full, borderRadius.md, borderRadius.xl, fontSizes.lg, fontSizes.sm, fontSizes.xs, insets.bottom, insets.top, spacing.lg, spacing.md, spacing.sm, spacing.xs, windowWidth],
  );

  if (loading || !request) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const statusLine = STATUS_PILL[request.status] ?? request.status.replace(/_/g, ' ');

  return (
    <View style={styles.container}>
      <WebView
        key={mapWebViewKey || 'mechanic-map'}
        source={{ html: mapHtml }}
        style={styles.map}
        scrollEnabled={false}
        androidLayerType="hardware"
      />
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.minimizeBtn}
          onPress={() => {
            if (request && user?.role === 'mechanic') syncFromServiceRequest(request, user.role);
            onMinimize?.();
          }}
          activeOpacity={0.85}
        >
          <Icon name="chevron-back" size={16} color={colors.primary} />
          <Text style={styles.minimizeText}>Continue in background</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetExpandedHeight,
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
      >
        <View {...sheetPanResponder.panHandlers} style={styles.sheetGrabArea}>
          <View style={styles.sheetGrabIndicator} />
          <Text style={styles.sheetGrabHint}>Drag up/down to show map or job details</Text>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.sheetInner}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          bounces
        >
          <Text style={styles.title}>Roadside active job</Text>
          <Text style={styles.subtitle}>
            {request.userName} · {request.vehicle}
          </Text>
          <Text style={styles.subtitle}>{request.pickupAddress || request.location}</Text>
          <Animated.View style={[styles.statusPill, { transform: [{ scale: pulse }] }]}>
            <Icon name="construct" size={16} color={colors.primary} />
            <Text style={styles.statusText}>{statusLine}</Text>
          </Animated.View>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.iconBtn} onPress={onCall} activeOpacity={0.85}>
              <Icon name="call" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => onOpenChat(request)} activeOpacity={0.85}>
              <Icon name="chatbubble" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {nextStatus ? (
            <TouchableOpacity disabled={saving} style={styles.nextBtn} onPress={onAdvanceStatus} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>
                {saving ? 'Updating...' : NEXT_BUTTON_LABEL[nextStatus] ?? nextStatus.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.nextBtn} onPress={onDone} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Back to dashboard</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};
