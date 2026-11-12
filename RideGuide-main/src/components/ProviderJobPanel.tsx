import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Icon } from './Icon';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { fetchDrivingRoute } from '../utils/drivingDistance';

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const DONE_GREEN = '#15803D';

type Point = { lat: number; lng: number };
export type JobEta = { km: number; minutes: number } | null | undefined;

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';

/**
 * Drive time and distance from the provider to `to`. Re-fetches only when either point moves
 * about 100 m (3 decimal places), so live GPS ticks don't flood the routing API.
 * `undefined` while loading, `null` when a point is missing or the lookup failed.
 */
export function useDrivingEta(from: Point | null, to: Point | null): JobEta {
  const [eta, setEta] = useState<JobEta>(undefined);
  const key = from && to ? [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(3)).join(',') : '';
  useEffect(() => {
    if (!from || !to) {
      setEta(null);
      return;
    }
    let cancelled = false;
    void fetchDrivingRoute(from, to, MAPBOX_TOKEN).then((route) => {
      if (!cancelled) setEta(route);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return eta;
}

/** Turn-by-turn directions in Google Maps (app if installed, otherwise the website). */
export function openDirections(to: Point | null) {
  if (!to) return;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=driving`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  void Linking.openURL(url);
}

/** The job map: Leaflet HTML in a WebView on phones, or in an iframe on web (WebView has no web support). */
export const JobMap: React.FC<{ html: string; mapKey: string }> = ({ html, mapKey }) => {
  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      key: mapKey,
      srcDoc: html,
      title: 'Job map',
      style: { border: 0, width: '100%', height: '100%', display: 'block' },
    });
  }
  return <WebView key={mapKey} source={{ html }} style={{ flex: 1 }} scrollEnabled={false} androidLayerType="hardware" />;
};

/** Back button (left) and Navigate pill (right) floating over the job map. */
export const JobMapTopBar: React.FC<{ onBack: () => void; onNavigate?: () => void; navigateLabel?: string }> = ({
  onBack,
  onNavigate,
  navigateLabel = 'Navigate',
}) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[topStyles.bar, { top: insets.top + 10 }]} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [topStyles.back, pressed && topStyles.pressed]}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to jobs. The job keeps running"
      >
        <Icon name="chevron-back" size={22} color={INK} />
      </Pressable>
      {onNavigate ? (
        <Pressable
          style={({ pressed }) => [topStyles.navigate, pressed && topStyles.pressed]}
          onPress={onNavigate}
          accessibilityRole="button"
          accessibilityLabel={`${navigateLabel} in Google Maps`}
        >
          <Icon name="navigate" size={16} color="#FFFFFF" />
          <Text style={topStyles.navigateText}>{navigateLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const topStyles = StyleSheet.create({
  bar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: INK,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  navigate: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: INK,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  navigateText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  pressed: { opacity: 0.85 },
});

interface SheetProps {
  title: string;
  subtitle?: string;
  /** Shown top-right while driving somewhere; omit to hide. */
  eta?: JobEta;
  customerName: string;
  vehicle: string;
  issue?: string;
  extraLines?: { label: string; value: string }[];
  onCall: () => void;
  onMessage: () => void;
  hasUnreadMessage: boolean;
  stepCount: number;
  stepsDone: number;
  stepLabels?: string[];
  primaryLabel: string;
  primaryTone?: 'blue' | 'green';
  onPrimary: () => void;
  busy?: boolean;
}

/** Bottom sheet for an active mechanic or tow job: status, ETA, customer, progress and the next step. */
export const JobSheet: React.FC<SheetProps> = ({
  title,
  subtitle,
  eta,
  customerName,
  vehicle,
  issue,
  extraLines,
  onCall,
  onMessage,
  hasUnreadMessage,
  stepCount,
  stepsDone,
  stepLabels,
  primaryLabel,
  primaryTone = 'blue',
  onPrimary,
  busy,
}) => {
  const insets = useSafeAreaInsets();
  const { fontSizes, scale } = useResponsive();
  const firstName = customerName.trim().split(/\s+/)[0] || 'customer';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        sheet: {
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          marginTop: -26,
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: Math.max(16, insets.bottom + 8),
          gap: 14,
          shadowColor: INK,
          shadowOpacity: 0.12,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -6 },
          elevation: 16,
        },
        handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' },
        headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
        title: { fontSize: Math.round(scale(22)), fontWeight: '800', color: INK },
        subtitle: { fontSize: fontSizes.sm, color: MUTED, marginTop: 2 },
        etaCol: { alignItems: 'flex-end' },
        etaMin: { fontSize: Math.round(scale(22)), fontWeight: '800', color: colors.primary },
        etaKm: { fontSize: 12, color: MUTED },
        customer: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: LINE, borderRadius: 18, padding: 12 },
        avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
        avatarText: { color: '#1D4ED8', fontWeight: '800', fontSize: 18 },
        name: { fontSize: fontSizes.md, fontWeight: '700', color: INK },
        vehicle: { fontSize: 13, color: MUTED, marginTop: 2 },
        issue: {
          alignSelf: 'flex-start',
          marginTop: 4,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: '#FFEDD5',
          maxWidth: '100%',
        },
        issueText: { fontSize: 12, fontWeight: '700', color: '#9A3412' },
        round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
        dot: {
          position: 'absolute',
          top: 8,
          right: 8,
          width: 9,
          height: 9,
          borderRadius: 5,
          backgroundColor: colors.error,
          borderWidth: 1.5,
          borderColor: '#FFFFFF',
        },
        extra: { fontSize: 13, color: '#334155', lineHeight: 18 },
        extraLabel: { fontWeight: '700', color: INK },
        steps: { flexDirection: 'row', gap: 4 },
        step: { flex: 1, height: 6, borderRadius: 4 },
        stepLabels: { flexDirection: 'row', marginTop: 6 },
        stepLabel: { flex: 1, fontSize: 11, color: MUTED, textAlign: 'center' },
        primary: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
        primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
        pressed: { opacity: 0.85 },
        flex: { flex: 1 },
        customerText: { flex: 1, minWidth: 0 },
      }),
    [insets.bottom, fontSizes, scale]
  );

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} accessibilityElementsHidden importantForAccessibility="no" />
      <View style={styles.headRow}>
        <View style={styles.flex}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {eta ? (
          <View style={styles.etaCol} accessibilityLabel={`${eta.minutes} minutes, ${eta.km.toFixed(1)} kilometres away`}>
            <Text style={styles.etaMin}>{eta.minutes} min</Text>
            <Text style={styles.etaKm}>{eta.km.toFixed(1)} km</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.customer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.customerText}>
          <Text style={styles.name} numberOfLines={1}>
            {customerName}
          </Text>
          <Text style={styles.vehicle} numberOfLines={1}>
            {vehicle}
          </Text>
          {issue ? (
            <View style={styles.issue}>
              <Text style={styles.issueText} numberOfLines={1}>
                {issue}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          onPress={onCall}
          accessibilityRole="button"
          accessibilityLabel={`Call ${firstName}`}
        >
          <Icon name="call" size={18} color={INK} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          onPress={onMessage}
          accessibilityRole="button"
          accessibilityLabel={hasUnreadMessage ? `Message ${firstName}, new message` : `Message ${firstName}`}
        >
          <Icon name="chatbubble" size={18} color={INK} />
          {hasUnreadMessage ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>

      {extraLines?.length ? (
        <View style={{ gap: 2 }}>
          {extraLines.map((l) => (
            <Text key={l.label} style={styles.extra} numberOfLines={2}>
              <Text style={styles.extraLabel}>{l.label}: </Text>
              {l.value}
            </Text>
          ))}
        </View>
      ) : null}

      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${Math.min(stepsDone, stepCount)} of ${stepCount}`}
      >
        <View style={styles.steps}>
          {Array.from({ length: stepCount }, (_, i) => (
            <View key={i} style={[styles.step, { backgroundColor: i < stepsDone ? colors.primary : LINE }]} />
          ))}
        </View>
        {stepLabels ? (
          <View style={styles.stepLabels}>
            {stepLabels.map((l, i) => (
              <Text key={l} style={[styles.stepLabel, i < stepsDone && { color: INK, fontWeight: '600' }]} numberOfLines={1}>
                {l}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: primaryTone === 'green' ? DONE_GREEN : colors.primary },
          (pressed || busy) && styles.pressed,
        ]}
        onPress={onPrimary}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{primaryLabel}</Text>}
      </Pressable>
    </View>
  );
};
