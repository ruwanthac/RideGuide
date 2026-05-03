import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import { WebView } from 'react-native-webview';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { ServiceRequest } from '../backend/types';
import { listServiceRequests, subscribeRequestById, updateServiceRequest } from '../backend/serviceRequestsService';
import { extractApiError } from '../backend/apiClient';
import { useUserRole } from '../context/UserRoleContext';

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

interface TowDriverActiveJobScreenProps {
  requestId: string;
  onDone: () => void;
}

export const TowDriverActiveJobScreen: React.FC<TowDriverActiveJobScreenProps> = ({ requestId, onDone }) => {
  const { spacing, fontSizes, borderRadius } = useResponsive();
  const { role } = useUserRole();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

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
    let off: (() => void) | undefined;
    let alive = true;
    (async () => {
      try {
        const items = await listServiceRequests();
        if (alive) setRequest(items.find((item) => item._id === requestId) ?? null);
        off = await subscribeRequestById(requestId, (doc) => {
          setRequest(doc);
          if (doc.status === 'completed') setTimeout(onDone, 1400);
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; off?.(); };
  }, [onDone, requestId]);

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
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
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
      const updated = await updateServiceRequest(request._id, nextStatus);
      setRequest(updated);
      if (updated.status === 'completed') setTimeout(onDone, 1400);
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
