import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { WebView } from 'react-native-webview';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { ServiceRequest } from '../backend/types';
import { listServiceRequests, subscribeRequestById, updateServiceRequest } from '../backend/serviceRequestsService';
import { extractApiError } from '../backend/apiClient';
import { useUserRole } from '../context/UserRoleContext';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useOngoingActivity } from '../context/OngoingActivityContext';

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
  const { role } = useUserRole();
  const { user } = useAuth();
  const { syncFromServiceRequest, clearForRequest } = useOngoingActivity();
  const navigation = useNavigation<any>();
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

  useEffect(() => {
    if (!request || !user || user.role !== 'owner') return;
    syncFromServiceRequest(request, user.role);
  }, [request, syncFromServiceRequest, user]);

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
        L.tileLayer('${MAP_TILE_URL}',{maxZoom:19, attribution:'${MAP_ATTRIBUTION}'}).addTo(map);
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
          top: spacing.xl + spacing.sm,
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
    [borderRadius.full, borderRadius.lg, fontSizes.lg, fontSizes.xs, spacing.lg, spacing.md, spacing.sm, spacing.xl, spacing.xs]
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
