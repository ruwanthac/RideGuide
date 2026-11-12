import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Icon } from './Icon';
import { UnreadRedDot } from './UnreadRedDot';
import { colors } from '../constants/theme';
import { fetchDrivingRoute } from '../utils/drivingDistance';
import { formatCurrencyAmount } from '../utils/formatMoneyAmount';
import type { ServiceRequest } from '../backend/types';

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';
/** Re-ask for a route only when the provider has moved this far, or this long has passed */
const ETA_MOVE_METERS = 150;
const ETA_REFRESH_MS = 60_000;

type Status = ServiceRequest['status'];

/** What the owner sees for each status: a plain headline and how far along the progress bar is. */
const OWNER_STATUS: Record<Status, { title: string; step: number }> = {
  requested: { title: 'Finding a tow truck', step: 0 },
  driver_picked_hire: { title: 'Driver accepted', step: 1 },
  driver_on_the_way: { title: 'On the way', step: 2 },
  driver_arrived: { title: 'Driver has arrived', step: 3 },
  vehicle_in_tow: { title: 'Towing your vehicle', step: 4 },
  pending: { title: 'Finding a mechanic', step: 0 },
  accepted: { title: 'Mechanic accepted', step: 1 },
  attending_to_location: { title: 'On the way', step: 2 },
  completed: { title: 'All done', step: 99 },
  cancelled: { title: 'Request cancelled', step: 0 },
};
const STEPS = {
  tow: ['Accepted', 'On the way', 'Arrived', 'Towing', 'Done'],
  roadside: ['Accepted', 'On the way', 'Done'],
};

function metersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Where the provider is heading now: the owner's pickup point, or the drop-off while towing. */
function destinationFor(request: ServiceRequest): { latitude: number; longitude: number } | null {
  if (request.status === 'vehicle_in_tow' && request.dropoffLatitude != null && request.dropoffLongitude != null) {
    return { latitude: request.dropoffLatitude, longitude: request.dropoffLongitude };
  }
  const lat = request.pickupLatitude ?? request.latitude;
  const lng = request.pickupLongitude ?? request.longitude;
  return typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0) ? { latitude: lat, longitude: lng } : null;
}

const MOVING: Status[] = ['driver_picked_hire', 'driver_on_the_way', 'vehicle_in_tow', 'accepted', 'attending_to_location'];

type Props = {
  request: ServiceRequest;
  /** Provider's latest known position (live from the request, or the screen's last known copy) */
  providerLocation: { latitude: number; longitude: number } | null;
  onCall: () => void;
  /** Omit when chat isn't available for this status */
  onChat?: () => void;
  hasUnreadChat?: boolean;
  /** Omit once the request can no longer be cancelled */
  onCancel?: () => void;
};

/** Bottom panel on the owner's tracking screens: status, arrival time, progress and the provider. */
export const TrackingPanel: React.FC<Props> = ({ request, providerLocation, onCall, onChat, hasUnreadChat, onCancel }) => {
  const kind = request.type === 'tow' ? 'tow' : 'roadside';
  const status = OWNER_STATUS[request.status] ?? { title: request.status, step: 0 };
  const steps = STEPS[kind];
  const done = request.status === 'completed';
  const searching = request.status === 'requested' || request.status === 'pending';
  const providerAssigned = !!request.acceptedBy && !searching && request.status !== 'cancelled';
  const providerName = request.acceptedProviderDisplayName?.trim() || (kind === 'tow' ? 'Your tow driver' : 'Your mechanic');
  const firstName = providerName.split(/\s+/)[0];

  // Arrival time while the provider is moving towards the owner (or the drop-off).
  const [eta, setEta] = useState<{ km: number; minutes: number } | null>(null);
  const lastEtaRef = useRef<{ at: number; from: { latitude: number; longitude: number } } | null>(null);
  const destination = destinationFor(request);
  const moving = MOVING.includes(request.status);
  useEffect(() => {
    if (!moving || !providerLocation || !destination) {
      setEta(null);
      lastEtaRef.current = null;
      return;
    }
    const last = lastEtaRef.current;
    if (last && Date.now() - last.at < ETA_REFRESH_MS && metersBetween(last.from, providerLocation) < ETA_MOVE_METERS) return;
    lastEtaRef.current = { at: Date.now(), from: providerLocation };
    let alive = true;
    let settled = false;
    void fetchDrivingRoute(
      { lat: providerLocation.latitude, lng: providerLocation.longitude },
      { lat: destination.latitude, lng: destination.longitude },
      MAPBOX_TOKEN
    ).then((route) => {
      settled = true;
      if (alive) setEta(route);
    });
    return () => {
      alive = false;
      // A lookup cancelled mid-flight (e.g. the status changed) must not count as a fresh result.
      if (!settled) lastEtaRef.current = null;
    };
  }, [moving, providerLocation?.latitude, providerLocation?.longitude, destination?.latitude, destination?.longitude, request.status]);

  const subtitle = done
    ? kind === 'tow'
      ? `Your ${request.vehicle} was towed to ${request.dropoffAddress || 'the drop-off'}.`
      : `${firstName} has finished helping with your ${request.vehicle}.`
    : searching
      ? kind === 'tow'
        ? 'We’ve sent your request to tow trucks nearby.'
        : 'We’ve sent your request to mechanics nearby.'
      : kind === 'tow'
        ? `Towing your ${request.vehicle}`
        : `Helping with your ${request.vehicle}`;

  const filled = done ? steps.length : Math.min(status.step, steps.length);
  const price = request.finalAmount ?? request.estimatedAmount;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: 16 },
        headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
        title: { fontSize: 22, fontWeight: '800', color: INK },
        subtitle: { fontSize: 14, color: MUTED, marginTop: 2, lineHeight: 20 },
        etaMain: { fontSize: 22, fontWeight: '800', color: colors.primary, textAlign: 'right' },
        etaSub: { fontSize: 12, color: MUTED, textAlign: 'right' },
        bar: { flexDirection: 'row', gap: 4 },
        seg: { flex: 1, height: 6, borderRadius: 4 },
        labels: { flexDirection: 'row', gap: 4, marginTop: -10 },
        label: { flex: 1, fontSize: 11 },
        searching: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EFF6FF', borderRadius: 16, padding: 14 },
        searchingText: { flex: 1, fontSize: 14, color: '#1E3A8A', lineHeight: 20 },
        card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: LINE, borderRadius: 18, padding: 12 },
        avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
        avatarText: { fontSize: 18, fontWeight: '800', color: '#1D4ED8' },
        name: { fontSize: 16, fontWeight: '700', color: INK },
        meta: { fontSize: 13, color: MUTED, marginTop: 2 },
        actions: { flexDirection: 'row', gap: 10 },
        action: {
          flex: 1,
          height: 50,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        actionText: { fontSize: 15, fontWeight: '700' },
        priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        priceLabel: { fontSize: 14, color: MUTED },
        priceValue: { fontSize: 15, fontWeight: '700', color: INK },
        cancel: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
        cancelText: { color: colors.error, fontSize: 15, fontWeight: '700' },
        pressed: { opacity: 0.85 },
      }),
    []
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">
            {status.title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {eta ? (
          <View accessible accessibilityLabel={`About ${eta.minutes} minutes, ${eta.km.toFixed(1)} kilometres away`}>
            <Text style={styles.etaMain}>{eta.minutes} min</Text>
            <Text style={styles.etaSub}>{eta.km.toFixed(1)} km away</Text>
          </View>
        ) : null}
      </View>

      {searching ? (
        <View style={styles.searching}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.searchingText}>
            You'll see who's coming as soon as someone accepts. This usually takes a few minutes.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.bar} accessible accessibilityLabel={`Step ${Math.min(filled, steps.length)} of ${steps.length}`}>
            {steps.map((s, i) => (
              <View key={s} style={[styles.seg, { backgroundColor: i < filled ? colors.primary : LINE }]} />
            ))}
          </View>
          <View style={styles.labels} importantForAccessibility="no-hide-descendants">
            {steps.map((s, i) => (
              <Text key={s} style={[styles.label, { color: i < filled ? INK : MUTED, fontWeight: i < filled ? '600' : '400' }]} numberOfLines={1}>
                {s}
              </Text>
            ))}
          </View>
        </>
      )}

      {providerAssigned ? (
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{providerName}</Text>
            <Text style={styles.meta}>{kind === 'tow' ? 'Tow truck driver' : 'Mechanic'}</Text>
          </View>
          {kind === 'tow' ? (
            <MaterialCommunityIcons name="tow-truck" size={26} color={MUTED} />
          ) : (
            <Icon name="construct" size={22} color={MUTED} />
          )}
        </View>
      ) : null}

      {providerAssigned && !done ? (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.action, { borderWidth: 1.5, borderColor: '#CBD5E1' }, pressed && styles.pressed]}
            onPress={onCall}
            accessibilityRole="button"
            accessibilityLabel={`Call ${providerName}`}
          >
            <Icon name="call" size={18} color={INK} />
            <Text style={[styles.actionText, { color: INK }]}>Call</Text>
          </Pressable>
          {onChat ? (
            <Pressable
              style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed]}
              onPress={onChat}
              accessibilityRole="button"
              accessibilityLabel={hasUnreadChat ? `Message ${providerName}, new messages` : `Message ${providerName}`}
            >
              <Icon name="chatbubble" size={18} color="#FFFFFF" />
              <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Message</Text>
              <UnreadRedDot visible={!!hasUnreadChat} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {kind === 'tow' && typeof price === 'number' && price > 0 ? (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{request.finalAmount != null ? 'Price' : 'Estimated price'}</Text>
          <Text style={styles.priceValue}>{formatCurrencyAmount(request.currency, price)}</Text>
        </View>
      ) : null}

      {onCancel ? (
        <Pressable style={styles.cancel} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel request</Text>
        </Pressable>
      ) : null}
    </View>
  );
};
