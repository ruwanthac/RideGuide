import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { NewsAndTips } from './NewsAndTips';
import { colors } from '../constants/theme';
import { useResponsive, useCompletedJobs, completedAt, isSameMonth, useTowLiveLocation, useProviderAvailability } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useUnreadRequestChat } from '../context/UnreadRequestChatContext';
import type { ServiceRequest } from '../backend/types';
import { formatCurrencyAmount } from '../utils/formatMoneyAmount';

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const SCREEN_BG = '#F4F6FA';
const ONLINE_GREEN = '#15803D';

/** Road distance and drive time to the customer; `null` = route lookup failed, `undefined` = still loading. */
export type ProviderRoute = { km: number; minutes: number } | null | undefined;

interface Props {
  role: 'mechanic' | 'tow';
  /** Open, unclaimed requests the provider can take. */
  requests: ServiceRequest[];
  routeFor: (req: ServiceRequest) => ProviderRoute;
  onAccept: (req: ServiceRequest) => Promise<void>;
  onOpenMap: (req: ServiceRequest) => void;
  onDiagnose: () => void;
  onChatAssistant: () => void;
  onVideoCall: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  refreshKey: number;
}

function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(iso).toLocaleDateString();
}

function minutesLeft(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((t - now) / 60000));
}

function routeLabel(route: ProviderRoute): string {
  if (route === undefined) return 'Finding route…';
  if (route === null) return 'Distance unavailable';
  return `${route.km.toFixed(1)} km · about ${route.minutes} min`;
}

export const ProviderHome: React.FC<Props> = ({
  role,
  requests,
  routeFor,
  onAccept,
  onOpenMap,
  onDiagnose,
  onChatAssistant,
  onVideoCall,
  refreshing,
  onRefresh,
  refreshKey,
}) => {
  const { user } = useAuth();
  const { hasUnreadRequestChat } = useUnreadRequestChat();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { fontSizes, scale } = useResponsive();

  const isTow = role === 'tow';
  const { online, switching, toggle } = useProviderAvailability();
  const businessName =
    user?.businessName?.trim() || (user?.displayName ?? '').trim() || (isTow ? 'Your tow service' : 'Your workshop');

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  // Re-render every 30 s so "2 min ago" and expiry counters stay current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { jobs: doneJobs } = useCompletedJobs(isTow ? 'tow' : 'roadside', refreshKey);
  const doneThisMonth = useMemo(() => {
    if (!doneJobs) return null;
    const t = new Date();
    return doneJobs.filter((j) => isSameMonth(completedAt(j), t.getFullYear(), t.getMonth())).length;
  }, [doneJobs]);
  // Tow drivers share their position while online so owners can see trucks nearby.
  useTowLiveLocation(isTow, online);

  const accept = async (req: ServiceRequest) => {
    if (acceptingId) return;
    setAcceptingId(req._id);
    try {
      await onAccept(req);
    } finally {
      setAcceptingId(null);
    }
  };

  const goToProfile = () => {
    const parent = navigation.getParent?.() ?? navigation;
    parent.navigate('ProfileTab');
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: SCREEN_BG },
        content: { paddingTop: insets.top + 12, paddingBottom: 24 },
        padded: { paddingHorizontal: 20 },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12 },
        greeting: { fontSize: fontSizes.sm, color: MUTED, fontWeight: '500' },
        name: { fontSize: Math.round(scale(24)), fontWeight: '800', color: INK, letterSpacing: -0.4 },
        avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' },
        avatarText: { color: '#C2410C', fontWeight: '800', fontSize: fontSizes.md },
        toggleCard: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: 16,
          borderRadius: 20,
          marginBottom: 12,
        },
        toggleOn: { backgroundColor: ONLINE_GREEN },
        toggleOff: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CBD5E1' },
        toggleTitle: { fontSize: Math.round(scale(18)), fontWeight: '800' },
        toggleText: { fontSize: 13, marginTop: 2 },
        track: { width: 56, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center' },
        knob: {
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: '#FFFFFF',
          shadowColor: INK,
          shadowOpacity: 0.3,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        },
        stats: { flexDirection: 'row', gap: 10, marginBottom: 20 },
        stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 12 },
        statValue: { fontSize: Math.round(scale(22)), fontWeight: '800', color: INK },
        statLabel: { fontSize: 12, color: MUTED, marginTop: 2 },
        sectionTitle: { fontSize: Math.round(scale(17)), fontWeight: '700', color: INK, marginBottom: 12 },
        list: { gap: 10, marginBottom: 24 },
        card: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: LINE, padding: 14, gap: 10 },
        cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
        customer: { fontSize: fontSizes.md, fontWeight: '700', color: INK },
        vehicle: { fontSize: 13, color: MUTED, marginTop: 2 },
        ago: { fontSize: 12, color: MUTED },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
        chipText: { fontSize: 12, fontWeight: '700' },
        address: { fontSize: 13, color: '#334155', lineHeight: 18 },
        addressLabel: { fontWeight: '700', color: INK },
        actions: { flexDirection: 'row', gap: 8 },
        mapButton: {
          flex: 1,
          height: 46,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: '#CBD5E1',
          backgroundColor: '#FFFFFF',
          flexDirection: 'row',
          gap: 6,
          alignItems: 'center',
          justifyContent: 'center',
        },
        mapText: { fontSize: 14, fontWeight: '700', color: INK },
        acceptButton: {
          flex: 2,
          height: 46,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        acceptText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
        empty: {
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: '#CBD5E1',
          padding: 22,
          alignItems: 'center',
          gap: 6,
          marginBottom: 24,
        },
        emptyTitle: { fontSize: 15, fontWeight: '700', color: INK },
        emptyText: { fontSize: 13, color: MUTED, lineHeight: 19, textAlign: 'center' },
        tools: { flexDirection: 'row', gap: 10, marginBottom: 24 },
        tool: {
          flex: 1,
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: LINE,
          paddingVertical: 12,
          paddingHorizontal: 8,
          alignItems: 'center',
          gap: 6,
        },
        toolIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
        toolText: { fontSize: 12, fontWeight: '700', color: INK, textAlign: 'center' },
        dot: {
          position: 'absolute',
          top: -2,
          right: -2,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.error,
          borderWidth: 1.5,
          borderColor: '#FFFFFF',
        },
        pressed: { opacity: 0.85 },
        flex: { flex: 1 },
      }),
    [insets.top, fontSizes, scale]
  );

  const renderRequest = (req: ServiceRequest) => {
    const route = routeFor(req);
    const left = minutesLeft(req.expiresAt, now);
    const amount = typeof req.estimatedAmount === 'number' ? formatCurrencyAmount(req.currency, req.estimatedAmount) : null;
    const scheduled = req.bookingType === 'scheduled' || Boolean(req.scheduledAt);
    const busy = acceptingId === req._id;
    return (
      <View key={req._id} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.flex}>
            <Text style={styles.customer} numberOfLines={1}>
              {req.userName}
            </Text>
            <Text style={styles.vehicle} numberOfLines={1}>
              {req.vehicle}
            </Text>
          </View>
          <Text style={styles.ago}>{timeAgo(req.createdAt, now)}</Text>
        </View>

        <View style={styles.chips}>
          {req.issue ? (
            <View style={[styles.chip, { backgroundColor: '#FFEDD5' }]}>
              <Text style={[styles.chipText, { color: '#9A3412' }]} numberOfLines={1}>
                {req.issue}
              </Text>
            </View>
          ) : null}
          <View style={[styles.chip, { backgroundColor: '#F1F5F9' }]}>
            <Text style={[styles.chipText, { color: '#334155' }]}>{routeLabel(route)}</Text>
          </View>
          {isTow && amount ? (
            <View style={[styles.chip, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.chipText, { color: '#166534' }]}>{amount}</Text>
            </View>
          ) : null}
          {left !== null && left <= 60 ? (
            <View style={[styles.chip, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.chipText, { color: '#92400E' }]}>Expires in {left} min</Text>
            </View>
          ) : null}
        </View>

        {isTow ? (
          <View style={{ gap: 2 }}>
            <Text style={styles.address} numberOfLines={2}>
              <Text style={styles.addressLabel}>Pick up: </Text>
              {req.pickupAddress?.trim() || req.location}
            </Text>
            <Text style={styles.address} numberOfLines={2}>
              <Text style={styles.addressLabel}>Drop off: </Text>
              {req.dropoffAddress?.trim() || 'Not given'}
            </Text>
            {scheduled ? (
              <Text style={styles.address}>
                <Text style={styles.addressLabel}>When: </Text>
                {req.scheduledAt ? new Date(req.scheduledAt).toLocaleString() : 'Time not set'}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.address} numberOfLines={2}>
            {req.location}
          </Text>
        )}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}
            onPress={() => onOpenMap(req)}
            accessibilityRole="button"
            accessibilityLabel={`Show ${req.userName}'s location on the map`}
          >
            <Icon name="map" size={16} color={INK} />
            <Text style={styles.mapText}>Map</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.acceptButton, (pressed || busy) && styles.pressed]}
            onPress={() => void accept(req)}
            disabled={Boolean(acceptingId)}
            accessibilityRole="button"
            accessibilityLabel={`Accept ${req.userName}'s job`}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.acceptText}>Accept job</Text>}
          </Pressable>
        </View>
      </View>
    );
  };

  const tools = [
    { key: 'diagnose', label: 'Diagnose', bg: '#DBEAFE', icon: <Icon name="construct" size={18} color="#1D4ED8" />, onPress: onDiagnose, dot: false },
    { key: 'chat', label: 'AI Assistant', bg: '#EDE9FE', icon: <Icon name="chatbubble" size={18} color="#6D28D9" />, onPress: onChatAssistant, dot: hasUnreadRequestChat },
    { key: 'video', label: 'Video expert', bg: '#E2E8F0', icon: <Icon name="videocam" size={18} color={INK} />, onPress: onVideoCall, dot: false },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      <View style={styles.padded}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.greeting}>{greetingFor()}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {businessName}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
            onPress={goToProfile}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
          >
            {isTow ? (
              <MaterialCommunityIcons name="tow-truck" size={22} color="#C2410C" />
            ) : (
              <Text style={styles.avatarText}>{businessName.charAt(0).toUpperCase()}</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.toggleCard, online ? styles.toggleOn : styles.toggleOff, (pressed || switching) && styles.pressed]}
          onPress={() => void toggle()}
          disabled={switching}
          accessibilityRole="switch"
          accessibilityState={{ checked: online, busy: switching }}
          accessibilityLabel={online ? 'You are online. Tap to go offline' : 'You are offline. Tap to go online'}
        >
          <View style={styles.flex}>
            <Text style={[styles.toggleTitle, { color: online ? '#FFFFFF' : INK }]}>
              {online ? 'You’re online' : 'You’re offline'}
            </Text>
            <Text style={[styles.toggleText, { color: online ? '#DCFCE7' : MUTED }]}>
              {switching
                ? 'Updating…'
                : online
                ? isTow
                  ? 'Drivers near you can book your truck'
                  : 'Drivers near you can send you jobs'
                : 'Tap to start receiving jobs'}
            </Text>
          </View>
          <View
            style={[
              styles.track,
              { backgroundColor: online ? 'rgba(255,255,255,0.35)' : '#CBD5E1', alignItems: online ? 'flex-end' : 'flex-start' },
            ]}
          >
            <View style={styles.knob} />
          </View>
        </Pressable>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{online ? requests.length : '–'}</Text>
            <Text style={styles.statLabel}>Waiting near you</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{doneThisMonth ?? '–'}</Text>
            <Text style={styles.statLabel}>Jobs done this month</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>New requests</Text>
        {!online ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>You’re offline</Text>
            <Text style={styles.emptyText}>
              Go online to see {isTow ? 'tow requests' : 'roadside requests'} from drivers near you.
            </Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.empty}>
            <Icon name={isTow ? 'car' : 'help-buoy'} size={24} color={MUTED} />
            <Text style={styles.emptyTitle}>No requests right now</Text>
            <Text style={styles.emptyText}>New {isTow ? 'tow' : 'roadside'} requests show up here as soon as a driver asks.</Text>
          </View>
        ) : (
          <View style={styles.list}>{requests.map(renderRequest)}</View>
        )}

        <Text style={styles.sectionTitle}>Tools</Text>
        <View style={styles.tools}>
          {tools.map((t) => (
            <Pressable
              key={t.key}
              style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
              onPress={t.onPress}
              accessibilityRole="button"
              accessibilityLabel={t.label}
            >
              <View style={[styles.toolIcon, { backgroundColor: t.bg }]}>
                {t.icon}
                {t.dot ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.toolText}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <NewsAndTips refreshKey={refreshKey} />
    </ScrollView>
  );
};
