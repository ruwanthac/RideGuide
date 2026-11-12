import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Linking, Alert } from 'react-native';
import * as Location from 'expo-location';
import { JobMap, JobMapTopBar, JobSheet, openDirections, useDrivingEta } from '../components/ProviderJobPanel';
import { colors } from '../constants/theme';
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

/** Sheet title and progress for each tow status (Accepted · On the way · Arrived · Towing · Done). */
const STAGE: Record<string, { title: string; stepsDone: number }> = {
  accepted: { title: 'Job accepted', stepsDone: 1 },
  driver_picked_hire: { title: 'Job accepted', stepsDone: 1 },
  driver_on_the_way: { title: 'On your way to pick up', stepsDone: 2 },
  driver_arrived: { title: 'At the pick-up point', stepsDone: 3 },
  vehicle_in_tow: { title: 'Towing to drop-off', stepsDone: 4 },
  completed: { title: 'Job complete', stepsDone: 5 },
};

/** Button text for moving *into* each next status. */
const NEXT_LABEL: Record<string, string> = {
  driver_picked_hire: 'Accept this job',
  driver_on_the_way: 'Start driving to pick up',
  driver_arrived: 'I’ve arrived at pick up',
  vehicle_in_tow: 'Vehicle loaded: start towing',
  completed: 'Delivered: mark as complete',
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
  const { role } = useUserRole();
  const { user } = useAuth();
  const { syncFromServiceRequest } = useOngoingActivity();
  const { hasUnreadRequestChat } = useUnreadRequestChat();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** Live GPS for “your truck” marker and map bounds. */
  const [driverLive, setDriverLive] = useState<{ latitude: number; longitude: number } | null>(null);
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

  const map = L.map('map', { zoomControl: false });
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
      Alert.alert('Could not update the job', extractApiError(error, 'Please try again.'));
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

  const status = request?.status;
  const towing = status === 'vehicle_in_tow';
  const pickupPoint = request ? resolveOwnerPickup(request) : null;
  const dropPair = sanitizeLatLng(request?.dropoffLatitude, request?.dropoffLongitude);
  const dropPoint = dropPair ? { lat: dropPair[0], lng: dropPair[1] } : null;
  const target = towing ? dropPoint : pickupPoint;
  const driving =
    status === 'accepted' || status === 'driver_picked_hire' || status === 'driver_on_the_way' || towing;
  const myPoint = driverLive ? { lat: driverLive.latitude, lng: driverLive.longitude } : null;
  const eta = useDrivingEta(driving ? myPoint : null, driving ? target : null);

  if (loading || !request) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const stage = STAGE[request.status] ?? STAGE.driver_picked_hire;
  const pickup = request.pickupAddress?.trim() || request.location;
  const dropoff = request.dropoffAddress?.trim() || 'Not given';
  const fare =
    typeof request.estimatedAmount === 'number'
      ? formatCurrencyAmount(request.currency, request.estimatedAmount)
      : null;
  const extraLines = [
    towing ? { label: 'Picked up from', value: pickup } : { label: 'Drop off', value: dropoff },
    ...(fare ? [{ label: 'Estimated fare', value: fare }] : []),
  ];
  const minimize = () => {
    if (user?.role === 'tow') syncFromServiceRequest(request, user.role);
    onMinimize?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <JobMap html={mapHtml} mapKey={mapWebViewKey || 'tow-map'} />
      </View>
      <JobMapTopBar
        onBack={minimize}
        onNavigate={driving && target ? () => openDirections(target) : undefined}
      />
      <JobSheet
        title={stage.title}
        subtitle={towing ? dropoff : pickup}
        eta={driving ? eta : undefined}
        customerName={request.userName}
        vehicle={request.vehicle}
        issue={request.issue}
        extraLines={extraLines}
        onCall={onCall}
        onMessage={() => onOpenChat(request)}
        hasUnreadMessage={hasUnreadRequestChat}
        stepCount={5}
        stepsDone={stage.stepsDone}
        stepLabels={['Accepted', 'On the way', 'Arrived', 'Towing', 'Done']}
        primaryLabel={nextStatus ? NEXT_LABEL[nextStatus] ?? 'Next step' : 'Back to jobs'}
        primaryTone={nextStatus === 'completed' ? 'green' : 'blue'}
        onPrimary={nextStatus ? onAdvanceStatus : onDone}
        busy={saving}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8EDF3' },
  mapArea: { flex: 1 },
});
