import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Linking, Alert } from 'react-native';
import * as Location from 'expo-location';
import { JobMap, JobMapTopBar, JobSheet, openDirections, useDrivingEta } from '../components/ProviderJobPanel';
import { colors } from '../constants/theme';
import type { ServiceRequest } from '../backend/types';
import { listServiceRequests, subscribeRequestById, updateServiceRequest } from '../backend/serviceRequestsService';
import { extractApiError } from '../backend/apiClient';
import { updateUserProfile } from '../backend/userProfileService';
import { useUserRole } from '../context/UserRoleContext';
import { useAuth } from '../context/AuthContext';
import { useOngoingActivity } from '../context/OngoingActivityContext';
import { useUnreadRequestChat } from '../context/UnreadRequestChatContext';

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

/** Sheet title and progress for each roadside status (Accepted · On the way · Done). */
const STAGE: Record<string, { title: string; stepsDone: number }> = {
  accepted: { title: 'Job accepted', stepsDone: 1 },
  attending_to_location: { title: 'On your way', stepsDone: 2 },
  completed: { title: 'Job complete', stepsDone: 3 },
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
  const { role } = useUserRole();
  const { user } = useAuth();
  const { syncFromServiceRequest } = useOngoingActivity();
  const { hasUnreadRequestChat } = useUnreadRequestChat();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mechanicLive, setMechanicLive] = useState<{ latitude: number; longitude: number } | null>(null);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRedirectedRef = useRef(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastLocationPatchAtRef = useRef(0);

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

  const map = L.map('map', { zoomControl: false });
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

  const ownerPoint = request ? resolveOwnerPickup(request) : null;
  const acceptedAt = sanitizeLatLng(
    request?.acceptedProviderLocation?.latitude,
    request?.acceptedProviderLocation?.longitude,
  );
  const myPoint = mechanicLive
    ? { lat: mechanicLive.latitude, lng: mechanicLive.longitude }
    : acceptedAt
    ? { lat: acceptedAt[0], lng: acceptedAt[1] }
    : null;
  const driving = request?.status === 'accepted' || request?.status === 'attending_to_location';
  const eta = useDrivingEta(driving ? myPoint : null, driving ? ownerPoint : null);

  if (loading || !request) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const firstName = request.userName.trim().split(/\s+/)[0] || 'the driver';
  const stage = STAGE[request.status] ?? STAGE.accepted;
  const minimize = () => {
    if (user?.role === 'mechanic') syncFromServiceRequest(request, user.role);
    onMinimize?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <JobMap html={mapHtml} mapKey={mapWebViewKey || 'mechanic-map'} />
      </View>
      <JobMapTopBar
        onBack={minimize}
        onNavigate={driving && ownerPoint ? () => openDirections(ownerPoint) : undefined}
      />
      <JobSheet
        title={stage.title}
        subtitle={request.pickupAddress || request.location}
        eta={driving ? eta : undefined}
        customerName={request.userName}
        vehicle={request.vehicle}
        issue={request.issue}
        onCall={onCall}
        onMessage={() => onOpenChat(request)}
        hasUnreadMessage={hasUnreadRequestChat}
        stepCount={3}
        stepsDone={stage.stepsDone}
        stepLabels={['Accepted', 'On the way', 'Done']}
        primaryLabel={
          nextStatus === 'attending_to_location'
            ? `Start driving to ${firstName}`
            : nextStatus === 'completed'
            ? 'Job done: mark as complete'
            : 'Back to jobs'
        }
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
