import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { NewsAndTips } from './NewsAndTips';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useVehicles } from '../context/VehiclesContext';
import { useProfileNotifications } from '../context/ProfileNotificationsContext';
import { listDiagnosisHistory } from '../backend/diagnosisHistoryService';
import type { DiagnosisEntry } from '../backend/types';

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const SCREEN_BG = '#F4F6FA';

/** Colours for the "last check" row, by diagnosis severity */
const SEVERITY_STYLE: Record<DiagnosisEntry['severity'], { label: string; bg: string; fg: string; icon: IconName }> = {
  critical: { label: 'Critical', bg: '#FEE2E2', fg: '#B91C1C', icon: 'warning' },
  moderate: { label: 'Needs attention', bg: '#FFEDD5', fg: '#C2410C', icon: 'warning' },
  minor: { label: 'Minor', bg: '#DCFCE7', fg: '#15803D', icon: 'checkmark-circle' },
};

function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

type Props = {
  onDiagnose: () => void;
  onChatAssistant: () => void;
  onRoadsideHelp: () => void;
  onTowTruck: () => void;
  onVideoCall: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  /** Bumped on pull-to-refresh so the news and last check reload */
  refreshKey: number;
};

/** Home screen for vehicle owners: their car and its last check up top, then the main actions. */
export const OwnerHome: React.FC<Props> = ({
  onDiagnose,
  onChatAssistant,
  onRoadsideHelp,
  onTowTruck,
  onVideoCall,
  refreshing,
  onRefresh,
  refreshKey,
}) => {
  const { user } = useAuth();
  const { vehicles, selectedVehicle, setSelectedVehicleId } = useVehicles();
  const { hasUnread } = useProfileNotifications();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { fontSizes, scale } = useResponsive();

  const vehicle = selectedVehicle ?? vehicles[0] ?? null;
  const firstName = (user?.displayName ?? '').trim().split(/\s+/)[0] || 'there';

  const [lastCheck, setLastCheck] = useState<DiagnosisEntry | null>(null);
  const [lastCheckLoaded, setLastCheckLoaded] = useState(false);

  const loadLastCheck = useCallback(async () => {
    if (!vehicle) return;
    try {
      const entries = await listDiagnosisHistory(vehicle._id);
      const newest = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
      setLastCheck(newest);
    } catch {
      // Keep the last known value; the row just stays as it was.
    } finally {
      setLastCheckLoaded(true);
    }
  }, [vehicle?._id]);

  useEffect(() => {
    setLastCheck(null);
    setLastCheckLoaded(false);
  }, [vehicle?._id]);
  useEffect(() => {
    void loadLastCheck();
  }, [loadLastCheck, refreshKey]);
  // A new diagnosis may have been run on another screen.
  useFocusEffect(
    useCallback(() => {
      void loadLastCheck();
    }, [loadLastCheck])
  );

  const goToTab = (tab: 'ProfileTab' | 'HistoryTab', screen?: string, params?: object) => {
    const parent = navigation.getParent?.() ?? navigation;
    parent.navigate(tab, screen ? { screen, params, initial: false } : undefined);
  };

  const openLastCheck = () => {
    if (lastCheck) goToTab('HistoryTab', 'DiagnosisHistoryDetail', { entry: lastCheck });
    else onDiagnose();
  };

  const changeVehicle = () => {
    if (vehicles.length < 2) {
      goToTab('ProfileTab');
      return;
    }
    Alert.alert('Choose a vehicle', undefined, [
      ...vehicles.map((v) => ({
        text: `${v.makeModel}${v.plate ? ` · ${v.plate}` : ''}`,
        onPress: () => void setSelectedVehicleId(v._id),
      })),
      { text: 'Manage vehicles', onPress: () => goToTab('ProfileTab') },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const severity = lastCheck ? SEVERITY_STYLE[lastCheck.severity] : null;
  const lastCheckSummary = lastCheck
    ? `${lastCheck.likelyCauses[0] ?? lastCheck.symptoms}${lastCheck.obdCode ? ` (${lastCheck.obdCode})` : ''} · ${shortDate(lastCheck.createdAt)}`
    : 'Run a diagnosis to check on your vehicle';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: SCREEN_BG },
        content: { paddingTop: insets.top + 12, paddingBottom: 24 },
        padded: { paddingHorizontal: 20 },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
        greeting: { fontSize: fontSizes.sm, color: MUTED, fontWeight: '500' },
        name: { fontSize: Math.round(scale(26)), fontWeight: '800', color: INK, letterSpacing: -0.4 },
        headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        roundButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: LINE,
          alignItems: 'center',
          justifyContent: 'center',
        },
        unreadDot: {
          position: 'absolute',
          top: 10,
          right: 11,
          width: 9,
          height: 9,
          borderRadius: 5,
          backgroundColor: colors.error,
          borderWidth: 1.5,
          borderColor: '#FFFFFF',
        },
        avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
        avatarText: { color: '#1D4ED8', fontWeight: '700', fontSize: fontSizes.md },
        vehicleCard: { backgroundColor: colors.primary, borderRadius: 24, padding: 18, gap: 14, marginBottom: 12 },
        vehicleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
        vehicleKicker: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, color: '#DBEAFE' },
        vehicleName: { fontSize: Math.round(scale(22)), fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
        vehicleMeta: { fontSize: fontSizes.sm, color: '#DBEAFE', marginTop: 2 },
        changeButton: {
          minHeight: 36,
          paddingHorizontal: 14,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.45)',
          justifyContent: 'center',
        },
        changeText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
        checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 10 },
        checkIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
        checkTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: INK },
        checkSub: { fontSize: 12, color: MUTED, marginTop: 1 },
        expertCard: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: 14,
          borderWidth: 1,
          borderColor: LINE,
          marginBottom: 18,
        },
        expertIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
        expertTitle: { fontSize: fontSizes.md, fontWeight: '700', color: INK },
        expertSub: { fontSize: 13, color: MUTED, marginTop: 2 },
        sectionTitle: { fontSize: Math.round(scale(17)), fontWeight: '700', color: INK, marginBottom: 12 },
        grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginBottom: 24 },
        tile: {
          width: '48.3%',
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: 14,
          gap: 10,
          borderWidth: 1,
          borderColor: LINE,
          minHeight: 118,
        },
        tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
        tileTitle: { fontSize: 15, fontWeight: '700', color: INK },
        tileSub: { fontSize: 12, color: MUTED, marginTop: 2 },
        pressed: { opacity: 0.85 },
        rowFlex: { flex: 1 },
      }),
    [insets.top, fontSizes, scale]
  );

  const tiles: { key: string; title: string; sub: string; bg: string; fg: string; icon: React.ReactNode; onPress: () => void }[] = [
    { key: 'diagnose', title: 'Diagnose', sub: 'Symptoms or OBD code', bg: '#DBEAFE', fg: '#1D4ED8', icon: <Icon name="construct" size={20} color="#1D4ED8" />, onPress: onDiagnose },
    { key: 'chat', title: 'AI Assistant', sub: 'Ask anything, add a photo', bg: '#EDE9FE', fg: '#6D28D9', icon: <Icon name="chatbubble" size={20} color="#6D28D9" />, onPress: onChatAssistant },
    { key: 'roadside', title: 'Roadside help', sub: 'A mechanic comes to you', bg: '#FFEDD5', fg: '#C2410C', icon: <Icon name="help-buoy" size={21} color="#C2410C" />, onPress: onRoadsideHelp },
    { key: 'tow', title: 'Tow truck', sub: 'Book now or schedule', bg: '#DCFCE7', fg: '#15803D', icon: <MaterialCommunityIcons name="tow-truck" size={22} color="#15803D" />, onPress: onTowTruck },
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
          <View>
            <Text style={styles.greeting}>{greetingFor()}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {firstName}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
              onPress={() => goToTab('ProfileTab', 'ProfileNotifications')}
              accessibilityRole="button"
              accessibilityLabel={hasUnread ? 'Notifications, new updates' : 'Notifications'}
            >
              <Icon name="notifications-outline" size={20} color={INK} />
              {hasUnread ? <View style={styles.unreadDot} /> : null}
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
              onPress={() => goToTab('ProfileTab')}
              accessibilityRole="button"
              accessibilityLabel="Your profile"
            >
              <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>

        {vehicle ? (
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleTop}>
              <View style={styles.rowFlex}>
                <Text style={styles.vehicleKicker}>MY VEHICLE</Text>
                <Text style={styles.vehicleName} numberOfLines={1}>
                  {vehicle.makeModel}
                </Text>
                <Text style={styles.vehicleMeta} numberOfLines={1}>
                  {[vehicle.year, vehicle.plate].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.changeButton, pressed && styles.pressed]}
                onPress={changeVehicle}
                accessibilityRole="button"
                accessibilityLabel={vehicles.length > 1 ? 'Change vehicle' : 'Manage vehicles'}
              >
                <Text style={styles.changeText}>{vehicles.length > 1 ? 'Change' : 'Manage'}</Text>
              </Pressable>
            </View>
            <Pressable
              style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
              onPress={openLastCheck}
              accessibilityRole="button"
              accessibilityLabel={severity ? `Last check: ${severity.label}. ${lastCheckSummary}` : 'No checks yet. Run a diagnosis'}
            >
              <View style={[styles.checkIcon, { backgroundColor: severity?.bg ?? '#E0E7FF' }]}>
                <Icon name={severity?.icon ?? 'pulse'} size={18} color={severity?.fg ?? '#4338CA'} />
              </View>
              <View style={styles.rowFlex}>
                <Text style={styles.checkTitle}>
                  {severity ? `Last check: ${severity.label}` : lastCheckLoaded ? 'No checks yet' : 'Checking history…'}
                </Text>
                <Text style={styles.checkSub} numberOfLines={1}>
                  {lastCheckSummary}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={MUTED} />
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.expertCard, pressed && styles.pressed]}
          onPress={onVideoCall}
          accessibilityRole="button"
          accessibilityLabel="Talk to the Vehicle Expert. Live AI video call"
        >
          <View style={styles.expertIcon}>
            <Icon name="videocam" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.rowFlex}>
            <Text style={styles.expertTitle}>Talk to the Vehicle Expert</Text>
            <Text style={styles.expertSub}>Live AI video call. Show it the problem.</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={MUTED} />
        </Pressable>

        <Text style={styles.sectionTitle}>What do you need?</Text>
        <View style={styles.grid}>
          {tiles.map((t) => (
            <Pressable
              key={t.key}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              onPress={t.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${t.title}. ${t.sub}`}
            >
              <View style={[styles.tileIcon, { backgroundColor: t.bg }]}>{t.icon}</View>
              <View>
                <Text style={styles.tileTitle}>{t.title}</Text>
                <Text style={styles.tileSub}>{t.sub}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <NewsAndTips refreshKey={refreshKey} />
    </ScrollView>
  );
};
