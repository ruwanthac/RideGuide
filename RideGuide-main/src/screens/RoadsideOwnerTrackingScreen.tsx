import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { ServiceRequest } from '../backend/types';
import { listServiceRequests, subscribeRequestById } from '../backend/serviceRequestsService';
import { useUserRole } from '../context/UserRoleContext';

const ROAD_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  attending_to_location: 'Attending to location',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const ROADSIDE_FLOW = ['pending', 'accepted', 'attending_to_location', 'completed'];

interface RoadsideOwnerTrackingScreenProps {
  requestId: string;
  onBackHome: () => void;
}

export const RoadsideOwnerTrackingScreen: React.FC<RoadsideOwnerTrackingScreenProps> = ({
  requestId,
  onBackHome,
}) => {
  const { spacing, fontSizes, borderRadius } = useResponsive();
  const { role } = useUserRole();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const pulse = useRef(new Animated.Value(0.8)).current;

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
          if (doc.status === 'completed') setTimeout(onBackHome, 1800);
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
            setTimeout(onBackHome, 1800);
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
      <style>html,body,#map{height:100%;margin:0;}</style></head>
      <body><div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const map=L.map('map').setView([${lat},${lng}],13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
        L.marker([${lat},${lng}]).addTo(map).bindPopup('Your location');
      </script></body></html>
    `;
  }, [request]);

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
        statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
        doneText: { color: colors.primary, marginLeft: spacing.sm, fontWeight: '600' },
        pendingText: { color: colors.textSecondary, marginLeft: spacing.sm },
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
      }),
    [borderRadius.full, borderRadius.lg, fontSizes.lg, spacing.lg, spacing.md, spacing.sm, spacing.xl, spacing.xs]
  );

  if (loading || !request) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const activeIndex = ROADSIDE_FLOW.indexOf(request.status);
  return (
    <View style={styles.container}>
      <WebView source={{ html: mapHtml }} style={styles.map} />
      <TouchableOpacity style={styles.backBtn} onPress={onBackHome} activeOpacity={0.8}>
        <Icon name="close" size={20} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.card}>
        <Text style={styles.title}>Roadside help tracking</Text>
        <Text style={styles.subtitle}>{request.pickupAddress || request.location}</Text>
        <Animated.View style={[styles.activePill, { transform: [{ scale: pulse }] }]}>
          <Icon name="construct" size={16} color={colors.primary} />
          <Text style={styles.activeText}>
            {ROAD_STATUS_LABELS[request.status] ?? request.status.replaceAll('_', ' ')}
          </Text>
        </Animated.View>
        <View style={{ marginTop: spacing.md }}>
          {ROADSIDE_FLOW.map((step, index) => (
            <View key={step} style={styles.statusRow}>
              <Icon
                name={index <= activeIndex ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={index <= activeIndex ? colors.primary : colors.textSecondary}
              />
              <Text style={index <= activeIndex ? styles.doneText : styles.pendingText}>
                {ROAD_STATUS_LABELS[step]}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};
