import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Icon, UnreadRedDot } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { ServiceRequest } from '../backend/types';
import { listServiceRequests, subscribeRequestById, updateServiceRequest } from '../backend/serviceRequestsService';
import { extractApiError } from '../backend/apiClient';
import { useUserRole } from '../context/UserRoleContext';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useOngoingActivity } from '../context/OngoingActivityContext';
import { useUnreadRequestChat } from '../context/UnreadRequestChatContext';
import { updateUserProfile } from '../backend/userProfileService';

const ROAD_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  attending_to_location: 'Attending to location',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const ROADSIDE_FLOW = ['pending', 'accepted', 'attending_to_location', 'completed'];
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';
const MAP_TILE_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = MAPBOX_TOKEN ? '© Mapbox © OpenStreetMap contributors' : '© OpenStreetMap contributors';

interface RoadsideOwnerTrackingScreenProps {
  requestId: string;
  onBackHome: () => void;
}

export const RoadsideOwnerTrackingScreen: React.FC<RoadsideOwnerTrackingScreenProps> = ({
  requestId,
  onBackHome,
}) => {
  const { spacing, fontSizes, borderRadius } = useResponsive();
  const insets = useSafeAreaInsets();
  const { role } = useUserRole();
  const { user } = useAuth();
  const { syncFromServiceRequest, clearForRequest } = useOngoingActivity();
  const { hasUnreadRequestChat } = useUnreadRequestChat();
  const navigation = useNavigation<any>();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  /** Device GPS while pending / en route (owner live on map). */
  const [deviceLive, setDeviceLive] = useState<{ latitude: number; longitude: number } | null>(null);
  const [lastKnownMechanicLocation, setLastKnownMechanicLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const lastLocationPatchAtRef = useRef(0);
  const pulse = useRef(new Animated.Value(0.8)).current;
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRedirectedRef = useRef(false);

  const scheduleBackHomeOnce = () => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
    completionTimeoutRef.current = setTimeout(onBackHome, 1800);
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
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.8, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  useEffect(() => {
    if (role !== 'owner') onBackHome();
  }, [onBackHome, role]);

  const syncRoadsidePendingLocationToServer = useCallback(
    async (latitude: number, longitude: number, options?: { force?: boolean }) => {
      const now = Date.now();
      if (!options?.force && now - lastLocationPatchAtRef.current < 5000) return;
      lastLocationPatchAtRef.current = now;
      try {
        await updateUserProfile({ location: { lat: latitude, lng: longitude } });
      } catch {
        // non-fatal
      }
    },
    []
  );

  useEffect(() => {
    const lat = request?.acceptedProviderLocation?.latitude;
    const lng = request?.acceptedProviderLocation?.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      setLastKnownMechanicLocation({ latitude: lat, longitude: lng });
    }
  }, [request?.acceptedProviderLocation?.latitude, request?.acceptedProviderLocation?.longitude]);

  useEffect(() => {
    const ownerLiveStatuses = ['pending', 'accepted', 'attending_to_location'];
    if (!request?.status || !ownerLiveStatuses.includes(request.status)) {
      setDeviceLive(null);
      return;
    }
    let cancelled = false;
    let sub: Location.LocationSubscription | undefined;
    void (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (cancelled || perm.status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setDeviceLive({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        await syncRoadsidePendingLocationToServer(pos.coords.latitude, pos.coords.longitude, { force: true });
      } catch {
        /* ignore */
      }
      try {
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          (pos) => {
            if (cancelled) return;
            setDeviceLive({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            void syncRoadsidePendingLocationToServer(pos.coords.latitude, pos.coords.longitude);
          }
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [request?.status, requestId, syncRoadsidePendingLocationToServer]);

  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    (async () => {
      try {
        const items = await listServiceRequests();
        const found = items.find((item) => item._id === requestId) ?? null;
        if (alive) setRequest(found);
        off = await subscribeRequestById(requestId, (doc) => {
          if (!doc) {
            setRequest(null);
            clearForRequest(requestId);
            scheduleBackHomeOnce();
            return;
          }
          setRequest(doc);
          if (doc.status === 'completed') scheduleBackHomeOnce();
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; off?.(); };
  }, [onBackHome, requestId]);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const items = await listServiceRequests();
          if (cancelled) return;
          const latest = items.find((item) => item._id === requestId);
          if (!latest) return;
          setRequest((prev) => {
            const prevLive = prev?.requesterLiveLocation;
            const nextLive = latest.requesterLiveLocation;
            const liveChanged =
              prevLive?.latitude !== nextLive?.latitude || prevLive?.longitude !== nextLive?.longitude;
            const prevProv = prev?.acceptedProviderLocation;
            const nextProv = latest.acceptedProviderLocation;
            const provChanged =
              prevProv?.latitude !== nextProv?.latitude || prevProv?.longitude !== nextProv?.longitude;
            if (
              !prev ||
              prev.status !== latest.status ||
              prev.updatedAt !== latest.updatedAt ||
              liveChanged ||
              provChanged
            ) {
              return latest;
            }
            return prev;
          });
          if (latest.status === 'completed') {
            scheduleBackHomeOnce();
          }
        } catch {
          // Ignore polling errors; realtime subscription still handles updates.
        }
      })();
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [onBackHome, requestId]);

  useEffect(() => {
    if (!request || !user || user.role !== 'owner') return;
    syncFromServiceRequest(request, user.role);
  }, [request, syncFromServiceRequest, user]);

  const mapHtml = useMemo(() => {
    const status = request?.status ?? 'pending';
    const isPending = status === 'pending';
    const isAttendingToLocation = status === 'attending_to_location';
    const isAcceptedOrEnRoute = status === 'accepted' || isAttendingToLocation;
    const isCompleted = status === 'completed';
    const pickupLat = request?.pickupLatitude ?? request?.latitude ?? 6.9271;
    const pickupLng = request?.pickupLongitude ?? request?.longitude ?? 79.8612;
    const serverLiveLat = request?.requesterLiveLocation?.latitude;
    const serverLiveLng = request?.requesterLiveLocation?.longitude;
    const devLat = deviceLive?.latitude;
    const devLng = deviceLive?.longitude;

    let ownerLat = pickupLat;
    let ownerLng = pickupLng;
    if (isPending || isAcceptedOrEnRoute) {
      if (typeof serverLiveLat === 'number' && typeof serverLiveLng === 'number') {
        ownerLat = serverLiveLat;
        ownerLng = serverLiveLng;
      } else if (typeof devLat === 'number' && typeof devLng === 'number') {
        ownerLat = devLat;
        ownerLng = devLng;
      }
    }

    const mechLatRaw = request?.acceptedProviderLocation?.latitude ?? lastKnownMechanicLocation?.latitude;
    const mechLngRaw = request?.acceptedProviderLocation?.longitude ?? lastKnownMechanicLocation?.longitude;
    const hasMechanicLocation = typeof mechLatRaw === 'number' && typeof mechLngRaw === 'number';

    const showOwnerCar = isPending || isAcceptedOrEnRoute;
    const canRenderMechanic = isAcceptedOrEnRoute || isCompleted;
    const routeMode = isAcceptedOrEnRoute ? 'mechanic_to_owner' : 'none';

    const fallbackMechLat = isCompleted ? pickupLat : ownerLat + 0.00035;
    const fallbackMechLng = isCompleted ? pickupLng : ownerLng + 0.00035;
    const mechLat = hasMechanicLocation ? mechLatRaw : fallbackMechLat;
    const mechLng = hasMechanicLocation ? mechLngRaw : fallbackMechLng;

    return `
      <!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>html,body,#map{height:100%;margin:0;} .lbl{font-size:11px;font-weight:bold;}</style></head>
      <body><div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const ownerLat=${ownerLat};
        const ownerLng=${ownerLng};
        const pickupLat=${pickupLat};
        const pickupLng=${pickupLng};
        const showOwnerCar=${showOwnerCar ? 'true' : 'false'};
        const canRenderMechanic=${canRenderMechanic ? 'true' : 'false'};
        const isCompleted=${isCompleted ? 'true' : 'false'};
        const hasMechanicLocation=${hasMechanicLocation ? 'true' : 'false'};
        const rawMechLat=${hasMechanicLocation ? mechLatRaw : 'null'};
        const rawMechLng=${hasMechanicLocation ? mechLngRaw : 'null'};
        const mechanicLat=${mechLat};
        const mechanicLng=${mechLng};
        const routeMode='${routeMode}';
        const isAttendingToLocation=${isAttendingToLocation ? 'true' : 'false'};

        const haversineMeters = (lat1, lon1, lat2, lon2) => {
          const R = 6371000;
          const toRad = (v) => v * Math.PI / 180;
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const ownerMechGapMeters = haversineMeters(ownerLat, ownerLng, mechanicLat, mechanicLng);
        const markersOverlapping = showOwnerCar && canRenderMechanic && !isCompleted && ownerMechGapMeters < 18;
        const ownerMarkerLat = markersOverlapping ? ownerLat + 0.00018 : ownerLat;
        const ownerMarkerLng = markersOverlapping ? ownerLng - 0.00018 : ownerLng;

        const points = [];
        if (showOwnerCar) points.push([ownerMarkerLat, ownerMarkerLng]);
        if (canRenderMechanic) points.push([mechanicLat, mechanicLng]);
        if (points.length === 0) points.push([pickupLat, pickupLng]);

        const map=L.map('map');
        if (points.length === 1) {
          map.setView(points[0], 15);
        } else {
          map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
        }
        L.tileLayer('${MAP_TILE_URL}',{maxZoom:19, attribution:'${MAP_ATTRIBUTION}'}).addTo(map);

        if (showOwnerCar) {
          L.marker([ownerMarkerLat, ownerMarkerLng], {
            icon: L.divIcon({
              className: 'owner-car-marker',
              html: '<div style="background:#2563EB;color:#fff;border-radius:999px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">🚗</div>',
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            })
          }).addTo(map).bindPopup('<span class="lbl">Your location</span>');
        } else if (!canRenderMechanic) {
          L.marker([pickupLat, pickupLng]).addTo(map).bindPopup('<span class="lbl">Pickup location</span>');
        }

        if (canRenderMechanic) {
          const mechPopup = isCompleted
            ? (hasMechanicLocation ? 'Mechanic location' : 'Mechanic · service location')
            : (hasMechanicLocation ? 'Mechanic live location' : 'Mechanic location (waiting for live GPS)');
          L.marker([mechanicLat, mechanicLng], {
            icon: L.divIcon({
              className: 'mechanic-live-marker',
              html: '<div style="background:#111;color:#fff;border-radius:999px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">🔧</div>',
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            })
          }).addTo(map).bindPopup('<span class="lbl">'+mechPopup+'</span>');
        }

        if (routeMode === 'mechanic_to_owner' && canRenderMechanic) {
          const distanceMeters = haversineMeters(mechanicLat, mechanicLng, ownerLat, ownerLng);
          // While mechanic is en route to you: hide the line once they're close (same idea as tow driver→drop).
          const hideThresholdMeters = isAttendingToLocation ? 35 : 0;
          if (distanceMeters > hideThresholdMeters) {
            const maxVisibleDistance = 1500;
            const opacity = Math.max(0.15, Math.min(0.95, distanceMeters / maxVisibleDistance));
            const drawStraightFallback = () => {
              L.polyline(
                [[mechanicLat, mechanicLng], [ownerLat, ownerLng]],
                { color: '#000000', weight: 4, opacity }
              ).addTo(map);
            };
            if ('${MAPBOX_TOKEN}'.length > 0) {
              const directionsUrl =
                'https://api.mapbox.com/directions/v5/mapbox/driving/' +
                mechanicLng + ',' + mechanicLat + ';' + ownerLng + ',' + ownerLat +
                '?geometries=geojson&overview=full&access_token=' + '${MAPBOX_TOKEN}';
              fetch(directionsUrl)
                .then((res) => res.json())
                .then((data) => {
                  const coords = data?.routes?.[0]?.geometry?.coordinates;
                  if (Array.isArray(coords) && coords.length > 1) {
                    const latLngs = coords
                      .filter((p) => Array.isArray(p) && p.length >= 2)
                      .map((p) => [p[1], p[0]]);
                    if (latLngs.length > 1) {
                      L.polyline(latLngs, { color: '#000000', weight: 4, opacity }).addTo(map);
                      return;
                    }
                  }
                  drawStraightFallback();
                })
                .catch(() => drawStraightFallback());
            } else {
              drawStraightFallback();
            }
          }
        }
      </script></body></html>
    `;
  }, [
    deviceLive?.latitude,
    deviceLive?.longitude,
    lastKnownMechanicLocation?.latitude,
    lastKnownMechanicLocation?.longitude,
    request,
  ]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        map: { height: '48%' },
        card: {
          margin: spacing.lg,
          marginTop: spacing.md,
          padding: spacing.lg,
          backgroundColor: colors.card,
          borderRadius: borderRadius.lg,
        },
        title: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
        subtitle: { color: colors.textSecondary, marginBottom: spacing.md },
        timelineContainer: {
          marginTop: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          backgroundColor: colors.background,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
        },
        timelineRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          minHeight: 56,
        },
        timelineRailWrap: {
          width: 28,
          alignItems: 'center',
          marginRight: spacing.sm,
        },
        timelineConnector: {
          position: 'absolute',
          top: 24,
          width: 2,
          height: 32,
          backgroundColor: colors.border,
          borderRadius: 1,
        },
        timelineConnectorDone: {
          backgroundColor: colors.primary,
        },
        timelineNodeOuter: {
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        },
        timelineNodeOuterDone: {
          borderColor: colors.primary,
        },
        timelineNodeInner: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.border,
        },
        timelineNodeInnerDone: {
          backgroundColor: colors.primary,
        },
        timelineContent: {
          flex: 1,
          paddingTop: 1,
        },
        timelineTitle: {
          fontSize: fontSizes.sm,
          fontWeight: '700',
          color: colors.text,
        },
        timelineTitleDone: {
          color: colors.primary,
        },
        timelineSubtitle: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 2,
        },
        activePill: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(37,99,235,0.12)',
        },
        activeText: { color: colors.primary, marginLeft: spacing.xs, fontWeight: '600' },
        mechanicSection: {
          marginTop: spacing.md,
          paddingTop: spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        mechanicLabel: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
        mechanicName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
        mechanicPhone: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
        actionsRow: { flexDirection: 'row', marginTop: spacing.md },
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
        backBtn: {
          position: 'absolute',
          top: spacing.xl + spacing.md,
          left: spacing.lg,
          backgroundColor: colors.card,
          width: 40,
          height: 40,
          borderRadius: 20,
          justifyContent: 'center',
          alignItems: 'center',
        },
        topBar: {
          position: 'absolute',
          top: (insets.top > 0 ? insets.top : spacing.xl) + spacing.sm,
          left: spacing.md,
          right: spacing.md,
          zIndex: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        },
        minimizePill: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.card,
          borderRadius: borderRadius.full,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          flexShrink: 1,
        },
        minimizePillText: { marginLeft: spacing.xs / 2, color: colors.text, fontSize: fontSizes.xs, fontWeight: '600' },
        cancelOutline: {
          borderWidth: 1,
          borderColor: colors.error,
          borderRadius: borderRadius.full,
          backgroundColor: colors.card,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        },
        cancelOutlineText: { color: colors.error, fontSize: fontSizes.xs, fontWeight: '700' },
      }),
    [
      borderRadius.full,
      borderRadius.lg,
      fontSizes.lg,
      fontSizes.xs,
      insets.top,
      spacing.lg,
      spacing.md,
      spacing.sm,
      spacing.xl,
      spacing.xs,
    ]
  );

  if (loading || !request) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const activeIndex = ROADSIDE_FLOW.indexOf(request.status);
  const showMechanicContact =
    request.status === 'accepted' ||
    request.status === 'attending_to_location' ||
    request.status === 'completed';
  const mechanicName = request.acceptedProviderDisplayName?.trim() || 'Your mechanic';
  const mechanicPhone = request.acceptedProviderPhone?.trim() ?? '';
  const ownerCanCancel = request.status === 'pending';

  const openCall = () => {
    if (!mechanicPhone) {
      Alert.alert('Phone unavailable', 'Your mechanic has not added a phone number yet.');
      return;
    }
    void Linking.openURL(`tel:${mechanicPhone}`);
  };

  const openChat = () => {
    navigation.navigate('RequestChat', {
      requestId: request._id,
      userName: mechanicName,
      vehicle: request.vehicle,
      issue: request.issue,
    });
  };

  const handleMinimize = () => {
    if (user?.role === 'owner') syncFromServiceRequest(request, user.role);
    onBackHome();
  };

  const confirmCancel = () => {
    Alert.alert('Cancel request?', 'This will stop your request.', [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await updateServiceRequest(request._id, 'cancelled');
              clearForRequest(request._id);
              onBackHome();
            } catch (e) {
              Alert.alert('Unable to cancel', extractApiError(e, 'Please try again'));
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <WebView source={{ html: mapHtml }} style={styles.map} />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.minimizePill} onPress={handleMinimize} activeOpacity={0.85}>
          <Icon name="chevron-back" size={18} color={colors.primary} />
          <Text style={styles.minimizePillText}>Continue in background</Text>
        </TouchableOpacity>
        {ownerCanCancel ? (
          <TouchableOpacity style={styles.cancelOutline} onPress={confirmCancel} activeOpacity={0.85}>
            <Text style={styles.cancelOutlineText}>Cancel request</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Roadside help tracking</Text>
        <Text style={styles.subtitle}>{request.pickupAddress || request.location}</Text>
        <Animated.View style={[styles.activePill, { transform: [{ scale: pulse }] }]}>
          <Icon name="construct" size={16} color={colors.primary} />
          <Text style={styles.activeText}>
            {ROAD_STATUS_LABELS[request.status] ?? request.status.replaceAll('_', ' ')}
          </Text>
        </Animated.View>
        {showMechanicContact ? (
          <View style={styles.mechanicSection}>
            <Text style={styles.mechanicLabel}>MECHANIC</Text>
            <Text style={styles.mechanicName}>{mechanicName}</Text>
            <Text style={styles.mechanicPhone}>{mechanicPhone || 'Phone number not on file'}</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.iconBtn} onPress={openCall} activeOpacity={0.85}>
                <Icon name="call" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={openChat} activeOpacity={0.85}>
                <Icon name="chatbubble" size={20} color={colors.primary} />
                <UnreadRedDot visible={hasUnreadRequestChat} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        <View style={styles.timelineContainer}>
          {ROADSIDE_FLOW.map((step, index) => {
            const isDone = index <= activeIndex;
            const isActive = index === activeIndex;
            const showConnector = index < ROADSIDE_FLOW.length - 1;
            return (
              <View key={step} style={styles.timelineRow}>
                <View style={styles.timelineRailWrap}>
                  {showConnector ? (
                    <View
                      style={[
                        styles.timelineConnector,
                        index < activeIndex && styles.timelineConnectorDone,
                      ]}
                    />
                  ) : null}
                  <Animated.View
                    style={[
                      styles.timelineNodeOuter,
                      isDone && styles.timelineNodeOuterDone,
                      isActive ? { transform: [{ scale: pulse }] } : null,
                    ]}
                  >
                    <View style={[styles.timelineNodeInner, isDone && styles.timelineNodeInnerDone]} />
                  </Animated.View>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineTitle, isDone && styles.timelineTitleDone]}>
                    {ROAD_STATUS_LABELS[step]}
                  </Text>
                  <Text style={styles.timelineSubtitle}>
                    {isActive ? 'Current step' : isDone ? 'Completed step' : 'Upcoming step'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};
