import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  PanResponder,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Icon, UnreadRedDot } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { ServiceRequest } from '../backend/types';
import { listServiceRequests, subscribeRequestById, updateServiceRequest } from '../backend/serviceRequestsService';
import { updateUserProfile } from '../backend/userProfileService';
import { extractApiError } from '../backend/apiClient';
import { useUserRole } from '../context/UserRoleContext';
import { useAuth } from '../context/AuthContext';
import { useOngoingActivity } from '../context/OngoingActivityContext';
import { useUnreadRequestChat } from '../context/UnreadRequestChatContext';
import { formatCurrencyAmount } from '../utils/formatMoneyAmount';

const NEXT_STATUS: Record<
  string,
  'driver_picked_hire' | 'driver_on_the_way' | 'driver_arrived' | 'vehicle_in_tow' | 'completed' | null
> = {
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

const BUTTON_LABELS: Record<string, string> = {
  driver_picked_hire: 'Mark picked up hire',
  driver_on_the_way: 'Mark on the way',
  driver_arrived: 'Mark arrived',
  vehicle_in_tow: 'Mark vehicle in tow',
  completed: 'Mark completed',
};

/** Short status line in the pill (matches tow tracking style). */
const STATUS_PILL_TEXT: Record<string, string> = {
  requested: 'requested',
  driver_picked_hire: 'driver picked hire',
  driver_on_the_way: 'driver on the way',
  driver_arrived: 'driver arrived',
  vehicle_in_tow: 'vehicle in tow',
  completed: 'completed',
  cancelled: 'cancelled',
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';
const MAP_TILE_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = MAPBOX_TOKEN ? '© Mapbox © OpenStreetMap contributors' : '© OpenStreetMap contributors';

/** Hide driver→owner road when within this distance (m). */
const ROUTE_HIDE_NEAR_OWNER_M = 120;
/** (0,0) and uninitialized numeric defaults from the client should never win over live/stored coords. */
const COORD_NEAR_ZERO_EPS = 1e-4;
/** Nudge displayed owner pin so it does not sit under the truck when coords match (same phone testing / drift). */
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

/** Pickup for the vehicle owner: stored job coords first, then live profile-derived fields from API. */
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

interface TowDriverActiveJobScreenProps {
  requestId: string;
  onMinimize?: () => void;
  onDone: () => void;
  onOpenChat: (request: ServiceRequest) => void;
}

export const TowDriverActiveJobScreen: React.FC<TowDriverActiveJobScreenProps> = ({
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
  const { hasUnreadRequestChat } = useUnreadRequestChat();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** Live GPS for “your truck” marker and map bounds. */
  const [driverLive, setDriverLive] = useState<{ latitude: number; longitude: number } | null>(null);
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

    const syncLocationToServer = async (latitude: number, longitude: number, options?: { force?: boolean }) => {
      if (!cancelled) setDriverLive({ latitude, longitude });
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
          { accuracy: Location.Accuracy.Balanced, timeInterval: 3000, distanceInterval: 5 },
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
  }, []);

  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    (async () => {
      try {
        const items = await listServiceRequests();
        if (alive) setRequest(items.find((item) => item._id === requestId) ?? null);
        off = await subscribeRequestById(requestId, (doc) => {
          if (!doc) {
            setRequest(null);
            scheduleDoneOnce();
            return;
          }
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
    if (!request || !user || user.role !== 'tow') return;
    syncFromServiceRequest(request, user.role);
  }, [request, syncFromServiceRequest, user]);

  const nextStatus = request ? NEXT_STATUS[request.status] : null;

  const mapWebViewKey = useMemo(() => {
    if (!request) return '';
    const owner = resolveOwnerPickup(request);
    return [
      request._id,
      request.status,
      request.updatedAt ?? '',
      owner?.lat ?? '—',
      owner?.lng ?? '—',
      driverLive?.latitude ?? 'x',
      driverLive?.longitude ?? 'y',
    ].join('|');
  }, [request, driverLive?.latitude, driverLive?.longitude]);

  const mapHtml = useMemo(() => {
    if (!request) return '';

    const pickupPopup = JSON.stringify(request.pickupAddress || request.location || 'Vehicle owner');
    const dropPopup = JSON.stringify(request.dropoffAddress || request.location || 'Drop-off');

    const fallbackCenter = { lat: 6.9271, lng: 79.8612 };
    const ownerResolved = resolveOwnerPickup(request);
    const hasOwnerCoords = !!ownerResolved;
    const pickupLat = ownerResolved?.lat ?? fallbackCenter.lat;
    const pickupLng = ownerResolved?.lng ?? fallbackCenter.lng;

    const dropPair = sanitizeLatLng(request.dropoffLatitude, request.dropoffLongitude);
    const dropLat = dropPair ? dropPair[0] : pickupLat + 0.015;
    const dropLng = dropPair ? dropPair[1] : pickupLng + 0.015;

    const dLat = driverLive?.latitude;
    const dLng = driverLive?.longitude;
    const hasDriver = typeof dLat === 'number' && typeof dLng === 'number';

    const truckLat = hasDriver ? dLat! : pickupLat;
    const truckLng = hasDriver ? dLng! : pickupLng;

    const st = request.status;
    /** completed → truck only · vehicle_in_tow → truck + drop + road · driver_arrived → truck only · on the way → owner + truck; road hides near owner · driver_picked_hire / requested → owner + truck + road until near */
    const phase: 'completed_truck' | 'drop_nav' | 'driver_solitary' | 'pickup_nav_hide_near' | 'pickup_nav' =
      st === 'completed'
        ? 'completed_truck'
        : st === 'vehicle_in_tow'
          ? 'drop_nav'
          : st === 'driver_arrived'
            ? 'driver_solitary'
            : st === 'driver_on_the_way' || st === 'accepted'
              ? 'pickup_nav_hide_near'
              : 'pickup_nav';

    const distToPickupM =
      hasDriver && hasOwnerCoords ? haversineMeters(truckLat, truckLng, pickupLat, pickupLng) : Number.POSITIVE_INFINITY;

    const showPickupPin = hasOwnerCoords && (phase === 'pickup_nav' || phase === 'pickup_nav_hide_near');
    const showDropPin = phase === 'drop_nav';
    const showTruckPin =
      phase === 'completed_truck' ||
      phase === 'driver_solitary' ||
      (phase === 'drop_nav' && hasDriver) ||
      ((phase === 'pickup_nav' || phase === 'pickup_nav_hide_near') && hasDriver);

    let ownerPinLat = pickupLat;
    let ownerPinLng = pickupLng;
    if (
      hasOwnerCoords &&
      hasDriver &&
      showPickupPin &&
      showTruckPin &&
      distToPickupM < OWNER_PIN_FANOUT_UNDER_M
    ) {
      ownerPinLat = pickupLat + 2.8e-4;
      ownerPinLng = pickupLng;
    }

    const drawBlackRouteToPickup =
      hasDriver &&
      hasOwnerCoords &&
      (phase === 'pickup_nav' ||
        (phase === 'pickup_nav_hide_near' && distToPickupM > ROUTE_HIDE_NEAR_OWNER_M));

    const drawBlackRouteToDrop = hasDriver && phase === 'drop_nav';

    const injectShowPickup = showPickupPin;
    const injectShowDrop = showDropPin;
    const injectShowTruck = showTruckPin;
    const injectDrawPickupRoute = drawBlackRouteToPickup;
    const injectDrawDropRoute = drawBlackRouteToDrop;
    const injectTruckLat = truckLat;
    const injectTruckLng = truckLng;
    const injectHasLiveGps = hasDriver;
    const injectPhase = phase;
    const injectOwnerPinLat = ownerPinLat;
    const injectOwnerPinLng = ownerPinLng;

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
  const pickupLat = ${pickupLat};
  const pickupLng = ${pickupLng};
  const ownerPinLat = ${injectOwnerPinLat};
  const ownerPinLng = ${injectOwnerPinLng};
  const dropLat = ${dropLat};
  const dropLng = ${dropLng};
  const truckLat = ${injectTruckLat};
  const truckLng = ${injectTruckLng};
  const hasLiveGps = ${injectHasLiveGps ? 'true' : 'false'};
  const showPickupPin = ${injectShowPickup ? 'true' : 'false'};
  const showDropPin = ${injectShowDrop ? 'true' : 'false'};
  const showTruckPin = ${injectShowTruck ? 'true' : 'false'};
  const drawBlackToPickup = ${injectDrawPickupRoute ? 'true' : 'false'};
  const drawBlackToDrop = ${injectDrawDropRoute ? 'true' : 'false'};

  const points = [];
  if (showPickupPin) points.push([ownerPinLat, ownerPinLng]);
  if (showDropPin) points.push([dropLat, dropLng]);
  if (showTruckPin) points.push([truckLat, truckLng]);

  const map = L.map('map');
  if (points.length === 0) {
    map.setView([pickupLat, pickupLng], 12);
  } else if (points.length === 1) {
    map.setView(points[0], PHASE === 'completed_truck' ? 14 : 13);
  } else {
    map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
  }
  L.tileLayer('${MAP_TILE_URL}', { maxZoom: 19, attribution: 'Leaflet | ${MAP_ATTRIBUTION}' }).addTo(map);

  const ownerPinHtml =
    '<div style="background:#2563EB;color:#fff;width:34px;height:34px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);">🚗</div>';
  const dropPinHtml =
    '<div style="background:#DC2626;color:#fff;width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:14px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);">⚑</div>';
  const truckPinHtml =
    '<div style="background:#111;color:#fff;width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);">🚚</div>';

  if (showPickupPin) {
    L.marker([ownerPinLat, ownerPinLng], {
      icon: L.divIcon({ className: 'pick', html: ownerPinHtml, iconSize: [34, 34], iconAnchor: [17, 17] }),
    })
      .addTo(map)
      .bindPopup('<span class="lbl">Vehicle owner · ' + ${pickupPopup} + '</span>');
  }
  if (showDropPin) {
    L.marker([dropLat, dropLng], {
      icon: L.divIcon({ className: 'drop', html: dropPinHtml, iconSize: [32, 32], iconAnchor: [16, 18] }),
    })
      .addTo(map)
      .bindPopup('<span class="lbl">Drop-off · ' + ${dropPopup} + '</span>');
  }
  if (showTruckPin) {
    const liveLabel = hasLiveGps ? 'You (live)' : 'Tow truck';
    L.marker([truckLat, truckLng], {
      icon: L.divIcon({ className: 'truck', html: truckPinHtml, iconSize: [40, 40], iconAnchor: [20, 20] }),
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

  if (drawBlackToPickup) {
    drawRoute(truckLat, truckLng, pickupLat, pickupLng);
  }
  if (drawBlackToDrop) {
    drawRoute(truckLat, truckLng, dropLat, dropLng);
  }
</script>
</body></html>
    `;
  }, [request, driverLive?.latitude, driverLive?.longitude]);

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
        subtitle: { color: colors.textSecondary, marginBottom: spacing.md },
        ownerPhone: { color: colors.textSecondary, marginBottom: spacing.sm, fontSize: fontSizes.sm },
        actionsRow: { flexDirection: 'row', marginBottom: spacing.sm },
        iconBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.primary + '10',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.sm,
          position: 'relative',
        },
        amount: { fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
        nextBtn: {
          backgroundColor: colors.primary,
          borderRadius: borderRadius.md,
          paddingVertical: spacing.md,
          alignItems: 'center',
          marginTop: spacing.md,
        },
        nextBtnText: { color: '#fff', fontWeight: '700' },
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
          /* ok */
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
          /* ok */
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

  if (loading || !request) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const statusLine =
    STATUS_PILL_TEXT[request.status] ?? request.status.replace(/_/g, ' ');

  const onCall = () => {
    if (!request?.phoneNumber?.trim()) {
      Alert.alert('No phone number', 'This request does not have a phone number.');
      return;
    }
    void Linking.openURL(`tel:${request.phoneNumber}`);
  };

  return (
    <View style={styles.container}>
      <WebView
        key={mapWebViewKey || 'tow-map'}
        source={{ html: mapHtml }}
        style={styles.map}
        scrollEnabled={false}
        androidLayerType="hardware"
      />
      <View style={styles.topBar}>
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
          <Text style={styles.title}>Tow active job</Text>
          <Text style={styles.subtitle}>
            {request.userName} · {request.vehicle}
          </Text>
          <Text style={styles.ownerPhone}>Owner contact: {request.phoneNumber || 'Not provided'}</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.iconBtn} onPress={onCall} activeOpacity={0.85}>
              <Icon name="call" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => onOpenChat(request)} activeOpacity={0.85}>
              <Icon name="chatbubble" size={18} color={colors.primary} />
              <UnreadRedDot visible={hasUnreadRequestChat} />
            </TouchableOpacity>
          </View>
          <Animated.View style={[styles.statusPill, { transform: [{ scale: pulse }] }]}>
            <Icon name="send" size={16} color={colors.primary} />
            <Text style={styles.statusText}>{statusLine}</Text>
          </Animated.View>
          <Text style={styles.amount}>
            Estimated fare: {formatCurrencyAmount(request.currency, request.estimatedAmount ?? 0)}
          </Text>
          {nextStatus ? (
            <TouchableOpacity disabled={saving} style={styles.nextBtn} onPress={onAdvanceStatus} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>
                {saving ? 'Updating...' : BUTTON_LABELS[nextStatus] ?? 'Next status'}
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
