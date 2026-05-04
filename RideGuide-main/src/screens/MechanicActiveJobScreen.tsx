import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { ServiceRequest } from '../backend/types';
import { listServiceRequests, subscribeRequestById, updateServiceRequest } from '../backend/serviceRequestsService';
import { extractApiError } from '../backend/apiClient';
import { useUserRole } from '../context/UserRoleContext';

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

const LABELS: Record<string, string> = {
  accepted: 'Accepted',
  attending_to_location: 'attending to location',
  completed: 'Completed',
};

interface MechanicActiveJobScreenProps {
  requestId: string;
  onDone: () => void;
  onOpenChat: (request: ServiceRequest) => void;
}

export const MechanicActiveJobScreen: React.FC<MechanicActiveJobScreenProps> = ({
  requestId,
  onDone,
  onOpenChat,
}) => {
  const { spacing, fontSizes, borderRadius } = useResponsive();
  const { role } = useUserRole();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (role !== 'mechanic') onDone();
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
          if (doc.status === 'completed') setTimeout(onDone, 1300);
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; off?.(); };
  }, [onDone, requestId]);

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
        const map=L.map('map').setView([${lat},${lng}],14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
        L.marker([${lat},${lng}]).addTo(map).bindPopup('Vehicle owner location').openPopup();
      </script></body></html>
    `;
  }, [request]);

  const nextStatus = request ? NEXT_STATUS[request.status] : null;

  const onAdvanceStatus = async () => {
    if (!request || !nextStatus) return;
    setSaving(true);
    try {
      const updated = await updateServiceRequest(request._id, nextStatus);
      setRequest(updated);
      if (updated.status === 'completed') setTimeout(onDone, 1300);
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
        map: { height: '52%' },
        panel: {
          margin: spacing.lg,
          marginTop: spacing.md,
          padding: spacing.lg,
          backgroundColor: colors.card,
          borderRadius: borderRadius.lg,
        },
        title: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
        subtitle: { color: colors.textSecondary, marginBottom: spacing.md },
        statusPill: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(37,99,235,0.12)',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        },
        statusText: { marginLeft: spacing.xs, color: colors.primary, fontWeight: '600' },
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
      }),
    [borderRadius.full, borderRadius.lg, borderRadius.md, fontSizes.lg, spacing.lg, spacing.md, spacing.sm, spacing.xs]
  );

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
        <Text style={styles.title}>Roadside active job</Text>
        <Text style={styles.subtitle}>{request.userName} · {request.vehicle}</Text>
        <Text style={styles.subtitle}>{request.pickupAddress || request.location}</Text>
        <View style={styles.statusPill}>
          <Icon name="construct" size={16} color={colors.primary} />
          <Text style={styles.statusText}>{LABELS[request.status] ?? request.status.replaceAll('_', ' ')}</Text>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={onCall} activeOpacity={0.85}>
            <Icon name="call" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onOpenChat(request)}
            activeOpacity={0.85}
          >
            <Icon name="chatbubble" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {nextStatus ? (
          <TouchableOpacity disabled={saving} style={styles.nextBtn} onPress={onAdvanceStatus} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>
              {saving ? 'Updating...' : (LABELS[nextStatus] ?? nextStatus.replaceAll('_', ' '))}
            </Text>
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
