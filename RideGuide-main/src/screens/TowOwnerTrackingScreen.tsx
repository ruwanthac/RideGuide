import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
  Alert,
  Dimensions,
  PanResponder,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { ServiceRequest } from '../backend/types';
import { listServiceRequests, subscribeRequestById, updateServiceRequest } from '../backend/serviceRequestsService';
import { extractApiError } from '../backend/apiClient';
import { useUserRole } from '../context/UserRoleContext';
import { useAuth } from '../context/AuthContext';
import { useOngoingActivity } from '../context/OngoingActivityContext';

const LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  attending_to_location: 'Attending to location',
  requested: 'Requested',
  driver_picked_hire: 'Driver picked up the hire',
  driver_on_the_way: 'Driver on the way',
  driver_arrived: 'Driver arrived',
  vehicle_in_tow: 'Vehicle in tow',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const TOW_FLOW = ['requested', 'driver_picked_hire', 'driver_on_the_way', 'driver_arrived', 'vehicle_in_tow', 'completed'];
const ROADSIDE_FLOW = ['pending', 'accepted', 'attending_to_location', 'completed'];
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';
const MAP_TILE_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = MAPBOX_TOKEN ? '© Mapbox © OpenStreetMap contributors' : '© OpenStreetMap contributors';

interface TowOwnerTrackingScreenProps {
  requestId: string;
  onBackHome: () => void;
  onOpenChat: (request: ServiceRequest) => void;
}

export const TowOwnerTrackingScreen: React.FC<TowOwnerTrackingScreenProps> = ({
  requestId,
  onBackHome,
  onOpenChat,
}) => {
  const insets = useSafeAreaInsets();
  const { spacing, fontSizes, borderRadius, iconSizes, width: windowWidth } = useResponsive();
  const { role } = useUserRole();
  const { user } = useAuth();
  const { syncFromServiceRequest, clearForRequest } = useOngoingActivity();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastKnownDriverLocation, setLastKnownDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const pulse = useRef(new Animated.Value(0.8)).current;
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRedirectedRef = useRef(false);

  const screenHeight = Dimensions.get('window').height;
  /** Collapsed peek height (mostly map visible). */
  const sheetCollapsedHeight = Math.round(screenHeight * 0.26) + insets.bottom;
  /** Expanded detail height (similar to prior fixed layout). */
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
          const next = Math.min(
            maxSheetTranslate,
            Math.max(0, sheetDragStartY.current + g.dy),
          );
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
      ]),
    ).start();
  }, [pulse]);

  useEffect(() => {
    if (role !== 'owner') onBackHome();
  }, [onBackHome, role]);

  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    (async () => {
      try {
        const items = await listServiceRequests();
        const found = items.find((item) => item._id === requestId) ?? null;
        if (alive) setRequest(found);
        off = await subscribeRequestById(requestId, (doc) => {
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
    const lat = request?.acceptedProviderLocation?.latitude;
    const lng = request?.acceptedProviderLocation?.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      setLastKnownDriverLocation({ latitude: lat, longitude: lng });
    }
  }, [request?.acceptedProviderLocation?.latitude, request?.acceptedProviderLocation?.longitude]);

  useEffect(() => {
    if (!request || !user || user.role !== 'owner') return;
    syncFromServiceRequest(request, user.role);
  }, [request, syncFromServiceRequest, user]);

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
            const prevDriver = prev?.acceptedProviderLocation;
            const nextDriver = latest.acceptedProviderLocation;
            const driverLocationChanged =
              prevDriver?.latitude !== nextDriver?.latitude ||
              prevDriver?.longitude !== nextDriver?.longitude;
            if (!prev || prev.status !== latest.status || prev.updatedAt !== latest.updatedAt || driverLocationChanged) {
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

  const mapHtml = useMemo(() => {
    const ownerLat = request?.requesterLiveLocation?.latitude ?? request?.pickupLatitude ?? request?.latitude ?? 6.9271;
    const ownerLng = request?.requesterLiveLocation?.longitude ?? request?.pickupLongitude ?? request?.longitude ?? 79.8612;
    const dropLat = request?.dropoffLatitude ?? request?.latitude ?? ownerLat;
    const dropLng = request?.dropoffLongitude ?? request?.longitude ?? ownerLng;
    const driverLat = request?.acceptedProviderLocation?.latitude ?? lastKnownDriverLocation?.latitude;
    const driverLng = request?.acceptedProviderLocation?.longitude ?? lastKnownDriverLocation?.longitude;
    const status = request?.status ?? 'requested';
    const isRequested = status === 'requested';
    const isDriverPicked = status === 'driver_picked_hire';
    const isDriverOnTheWay = status === 'driver_on_the_way';
    const isDriverArrived = status === 'driver_arrived';
    const isVehicleInTow = status === 'vehicle_in_tow';
    const isCompleted = status === 'completed';
    const showOwnerMarker = isRequested || isDriverPicked || isDriverOnTheWay || isDriverArrived;
    const showDropFlag = isVehicleInTow || isCompleted;
    const showDriverMarker = isDriverPicked || isDriverOnTheWay || isDriverArrived || isVehicleInTow;
    const routeMode = isVehicleInTow ? 'driver_to_drop' : (isDriverPicked || isDriverOnTheWay || isDriverArrived ? 'driver_to_owner' : 'none');
    const hasDriverLocation = typeof driverLat === 'number' && typeof driverLng === 'number';
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
        const dropLat=${dropLat};
        const dropLng=${dropLng};
        const showOwnerMarker=${showOwnerMarker ? 'true' : 'false'};
        const showDropFlag=${showDropFlag ? 'true' : 'false'};
        const showDriverMarker=${showDriverMarker ? 'true' : 'false'};
        const hasDriverLocation=${hasDriverLocation ? 'true' : 'false'};
        const routeMode='${routeMode}';
        const rawDriverLat=${typeof driverLat === 'number' ? driverLat : 'null'};
        const rawDriverLng=${typeof driverLng === 'number' ? driverLng : 'null'};
        const allowDriverFallback = routeMode !== 'driver_to_drop';
        const fallbackDriverLat = showDropFlag ? dropLat + 0.00035 : ownerLat + 0.00035;
        const fallbackDriverLng = showDropFlag ? dropLng + 0.00035 : ownerLng + 0.00035;
        const canRenderDriver = showDriverMarker && (hasDriverLocation || allowDriverFallback);
        const driverLat = hasDriverLocation ? rawDriverLat : fallbackDriverLat;
        const driverLng = hasDriverLocation ? rawDriverLng : fallbackDriverLng;
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
        const ownerDriverGapMeters = haversineMeters(ownerLat, ownerLng, driverLat, driverLng);
        const markersOverlapping = showOwnerMarker && canRenderDriver && ownerDriverGapMeters < 18;
        const ownerMarkerLat = markersOverlapping ? ownerLat + 0.00018 : ownerLat;
        const ownerMarkerLng = markersOverlapping ? ownerLng - 0.00018 : ownerLng;
        const points = [];
        if (showOwnerMarker) points.push([ownerMarkerLat, ownerMarkerLng]);
        if (showDropFlag) points.push([dropLat, dropLng]);
        if (canRenderDriver) points.push([driverLat, driverLng]);
        if (points.length === 0) points.push([ownerLat, ownerLng]);
        const map=L.map('map');
        if (points.length === 1) {
          map.setView(points[0], 15);
        } else {
          map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
        }
        L.tileLayer('${MAP_TILE_URL}',{maxZoom:19, attribution:'${MAP_ATTRIBUTION}'}).addTo(map);
        if (showOwnerMarker) {
          L.marker([ownerMarkerLat,ownerMarkerLng], {
            icon: L.divIcon({
              className: 'owner-car-marker',
              html: '<div style="background:#2563EB;color:#fff;border-radius:999px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">🚗</div>',
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            })
          }).addTo(map).bindPopup('<span class="lbl">${isRequested ? 'Your current location' : 'Vehicle owner location'}</span>');
        }
        if (showDropFlag) {
          L.marker([dropLat,dropLng], {
            icon: L.divIcon({
              className: 'drop-flag-marker',
              html: '<div style="background:#DC2626;color:#fff;border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">⚑</div>',
              iconSize: [30, 30],
              iconAnchor: [15, 24]
            })
          }).addTo(map).bindPopup('<span class="lbl">Drop location</span>');
        }
        if (canRenderDriver) {
          L.marker([driverLat,driverLng], {
            icon: L.divIcon({
              className: 'tow-truck-marker',
              html: '<div style="background:#111;color:#fff;border-radius:999px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">🚚</div>',
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            })
          }).addTo(map).bindPopup('<span class="lbl">'+(hasDriverLocation ? 'Tow truck live location' : 'Tow truck location (waiting for live GPS)')+'</span>');
        }

        if (routeMode !== 'none' && canRenderDriver) {
          let routeEndLat = ownerLat;
          let routeEndLng = ownerLng;
          if (routeMode === 'driver_to_drop') {
            routeEndLat = dropLat;
            routeEndLng = dropLng;
          }
          const distanceMeters = haversineMeters(driverLat, driverLng, routeEndLat, routeEndLng);
          const hideThresholdMeters = routeMode === 'driver_to_owner' ? 0 : 35;
          if (distanceMeters > hideThresholdMeters) {
            const maxVisibleDistance = 1500;
            const opacity = Math.max(0.15, Math.min(0.95, distanceMeters / maxVisibleDistance));
            const drawStraightFallback = () => {
              L.polyline(
                [[driverLat,driverLng],[routeEndLat,routeEndLng]],
                {color:'#000000', weight:4, opacity}
              ).addTo(map);
            };

            if ('${MAPBOX_TOKEN}'.length > 0) {
              const directionsUrl =
                'https://api.mapbox.com/directions/v5/mapbox/driving/' +
                driverLng + ',' + driverLat + ';' + routeEndLng + ',' + routeEndLat +
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
  }, [lastKnownDriverLocation?.latitude, lastKnownDriverLocation?.longitude, request]);

  const styles = useMemo(() => StyleSheet.create({
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
      flexShrink: 0,
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
    activePill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, backgroundColor: 'rgba(37,99,235,0.12)' },
    activeText: { color: colors.primary, marginLeft: spacing.xs, fontWeight: '600' },
    actionsRow: { flexDirection: 'row', marginTop: spacing.sm, marginBottom: spacing.xs },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary + '10',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    amount: { marginTop: spacing.md, fontSize: fontSizes.md, color: colors.text, fontWeight: '700' },
    topBar: {
      position: 'absolute',
      top: insets.top + spacing.sm,
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
    minimizePillText: {
      marginLeft: spacing.xs / 2,
      color: colors.text,
      fontSize: fontSizes.xs,
      fontWeight: '600',
    },
    cancelOutline: {
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: borderRadius.full,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    cancelOutlineText: { color: colors.error, fontSize: fontSizes.xs, fontWeight: '700' },
  }), [
    borderRadius.full,
    borderRadius.lg,
    borderRadius.xl,
    fontSizes.lg,
    fontSizes.md,
    fontSizes.xs,
    iconSizes.sm,
    insets.top,
    insets.bottom,
    spacing.lg,
    spacing.md,
    spacing.sm,
    spacing.xl,
    spacing.xs,
    windowWidth,
  ]);

  if (loading || !request) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const flow = request.type === 'roadside' ? ROADSIDE_FLOW : TOW_FLOW;
  const activeIndex = flow.indexOf(request.status);
  const heading = request.type === 'roadside' ? 'Roadside tracking' : 'Tow tracking';
  const subtitle = request.type === 'roadside'
    ? request.pickupAddress || request.location
    : `${request.pickupAddress || request.location} → ${request.dropoffAddress || request.location}`;
  const amountLabel = request.type === 'roadside' ? 'Estimated service' : 'Estimated fare';
  const ownerCanCancel = request.type === 'tow' ? request.status === 'requested' : request.status === 'pending';
  const ownerCanChatTow =
    request.type === 'tow' &&
    ['driver_picked_hire', 'driver_on_the_way', 'driver_arrived', 'vehicle_in_tow'].includes(request.status);

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
      <WebView
        source={{ html: mapHtml }}
        style={styles.map}
        scrollEnabled={false}
        scalesPageToFit={false}
        androidLayerType="hardware"
      />
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
          <Text style={styles.sheetGrabHint}>Drag up/down to show map or details</Text>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.sheetInner}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          bounces
        >
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Animated.View style={[styles.activePill, { transform: [{ scale: pulse }] }]}>
            <Icon name={request.type === 'roadside' ? 'construct' : 'car'} size={16} color={colors.primary} />
            <Text style={styles.activeText}>{LABELS[request.status] ?? request.status}</Text>
          </Animated.View>
          {ownerCanChatTow ? (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => onOpenChat(request)} activeOpacity={0.85}>
                <Icon name="chatbubble" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : null}
          <Text style={styles.amount}>
            {amountLabel}: {request.currency ?? 'LKR'} {Math.round(request.estimatedAmount ?? 0)}
          </Text>
          <View style={styles.timelineContainer}>
            {flow.map((step, index) => {
              const isDone = index <= activeIndex;
              const isActive = index === activeIndex;
              const showConnector = index < flow.length - 1;
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
                    <Text style={[styles.timelineTitle, isDone && styles.timelineTitleDone]}>{LABELS[step]}</Text>
                    <Text style={styles.timelineSubtitle}>
                      {isActive ? 'Current step' : isDone ? 'Completed step' : 'Upcoming step'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
};
