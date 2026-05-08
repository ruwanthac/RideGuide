import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { ServiceRequest } from '../backend/types';
import { listServiceRequests, subscribeRequestById } from '../backend/serviceRequestsService';
import { useUserRole } from '../context/UserRoleContext';

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
}

export const TowOwnerTrackingScreen: React.FC<TowOwnerTrackingScreenProps> = ({ requestId, onBackHome }) => {
  const { spacing, fontSizes, borderRadius, iconSizes } = useResponsive();
  const { role } = useUserRole();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
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
    let cancelled = false;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const items = await listServiceRequests();
          if (cancelled) return;
          const latest = items.find((item) => item._id === requestId);
          if (!latest) return;
          setRequest((prev) => {
            if (!prev || prev.status !== latest.status || prev.updatedAt !== latest.updatedAt) {
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
    const lat = request?.pickupLatitude ?? request?.latitude ?? 6.9271;
    const lng = request?.pickupLongitude ?? request?.longitude ?? 79.8612;
    return `
      <!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>html,body,#map{height:100%;margin:0;} .lbl{font-size:11px;font-weight:bold;}</style></head>
      <body><div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const map=L.map('map').setView([${lat},${lng}],13);
        L.tileLayer('${MAP_TILE_URL}',{maxZoom:19, attribution:'${MAP_ATTRIBUTION}'}).addTo(map);
        L.marker([${lat},${lng}]).addTo(map).bindPopup('<span class="lbl">Pickup</span>');
      </script></body></html>
    `;
  }, [request]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    map: { height: '48%' },
    card: { margin: spacing.lg, marginTop: spacing.md, padding: spacing.lg, backgroundColor: colors.card, borderRadius: borderRadius.lg },
    title: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
    subtitle: { color: colors.textSecondary, marginBottom: spacing.md },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    doneText: { color: colors.primary, marginLeft: spacing.sm, fontWeight: '600' },
    pendingText: { color: colors.textSecondary, marginLeft: spacing.sm },
    activePill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, backgroundColor: 'rgba(37,99,235,0.12)' },
    activeText: { color: colors.primary, marginLeft: spacing.xs, fontWeight: '600' },
    amount: { marginTop: spacing.md, fontSize: fontSizes.md, color: colors.text, fontWeight: '700' },
    backBtn: { position: 'absolute', top: spacing.xl + spacing.md, left: spacing.lg, backgroundColor: colors.card, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  }), [borderRadius.full, borderRadius.lg, fontSizes.lg, fontSizes.md, iconSizes.sm, spacing.lg, spacing.md, spacing.sm, spacing.xl, spacing.xs]);

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
  return (
    <View style={styles.container}>
      <WebView source={{ html: mapHtml }} style={styles.map} />
      <TouchableOpacity style={styles.backBtn} onPress={onBackHome} activeOpacity={0.8}>
        <Icon name="close" size={20} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.card}>
        <Text style={styles.title}>{heading}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Animated.View style={[styles.activePill, { transform: [{ scale: pulse }] }]}>
          <Icon name={request.type === 'roadside' ? 'construct' : 'car'} size={16} color={colors.primary} />
          <Text style={styles.activeText}>{LABELS[request.status] ?? request.status}</Text>
        </Animated.View>
        <Text style={styles.amount}>
          {amountLabel}: {request.currency ?? 'LKR'} {Math.round(request.estimatedAmount ?? 0)}
        </Text>
        <View style={{ marginTop: spacing.md }}>
          {flow.map((step, index) => (
            <View key={step} style={styles.statusRow}>
              <Icon name={index <= activeIndex ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={index <= activeIndex ? colors.primary : colors.textSecondary} />
              <Text style={index <= activeIndex ? styles.doneText : styles.pendingText}>{LABELS[step]}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};
