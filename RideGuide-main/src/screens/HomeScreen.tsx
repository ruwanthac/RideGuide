import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { Card, Icon, UnreadRedDot } from '../components';
import { colors } from '../constants/theme';
import type { IconName } from '../components';
import { useResponsive } from '../hooks';
import { useUserRole } from '../context/UserRoleContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useVehicles } from '../context/VehiclesContext';
import { useAuth } from '../context/AuthContext';
import { useUnreadRequestChat } from '../context/UnreadRequestChatContext';
import { subscribeServiceRequests, updateServiceRequest } from '../backend/serviceRequestsService';
import type { ServiceRequest } from '../backend/types';
import { extractApiError } from '../backend/apiClient';
import {
  getLastAccessedFunctions,
  recordHomeFunctionAccess,
  type HomeFunctionId,
} from '../utils/homeLastAccessed';

interface MenuItem {
  id: string;
  icon: IconName;
  title: string;
  onPress: () => void;
}

interface HomeScreenProps {
  onDiagnose: () => void;
  onTowTruckAssistant: () => void;
  onChatAssistant: () => void;
  onVideoCallPress?: () => void;
}

const HERO_IMAGE = require('../../assets/images/hero.gif');

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  let greeting = '';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 18) greeting = 'Good Afternoon';
  else greeting = 'Good Evening';
  return greeting;
}

const MENU_ITEMS: Omit<MenuItem, 'onPress'>[] = [
  { id: 'diagnose', icon: 'construct', title: 'Diagnose Issue' },
  { id: 'chat', icon: 'chatbubble', title: 'AI Assistant' },
  { id: 'tow', icon: 'car', title: 'Tow Truck Assistant and Roadside Help' },
];

const BANNER_IMAGES = [
  require('../../assets/images/img1.gif'),
  require('../../assets/images/img2.gif'),
  require('../../assets/images/img3.gif'),
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onDiagnose,
  onTowTruckAssistant,
  onChatAssistant,
  onVideoCallPress,
}) => {
  const { spacing, fontSizes, iconSizes, isSmallScreen, scale, width, verticalScale } = useResponsive();
  const { role } = useUserRole();
  const { selectedVehicleId, refresh: refreshVehicles } = useVehicles();
  const { refreshProfile, user } = useAuth();
  const { hasUnreadRequestChat } = useUnreadRequestChat();
  const greeting = getTimeBasedGreeting();
  const [bannerIndex, setBannerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  /** Bumped on pull-to-refresh so the service-request subscription reloads from the API (resets socket listener state). */
  const [requestReloadToken, setRequestReloadToken] = useState(0);
  const [lastAccessedIds, setLastAccessedIds] = useState<HomeFunctionId[]>([]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let alive = true;
    (async () => {
      try {
        if (role === 'tow' && !user?._id) {
          if (alive) setRequests([]);
          return;
        }
        if (role === 'mechanic' && !user?._id) {
          if (alive) setRequests([]);
          return;
        }
        const filter =
          role === 'owner' && selectedVehicleId
            ? { vehicleId: selectedVehicleId }
            : role === 'mechanic' && user?._id
            ? {
                type: 'roadside' as const,
                inboxOnly: true as const,
                mechanicRoadsidePendingOnly: true as const,
              }
            : role === 'tow' && user?._id
            ? { type: 'tow' as const, inboxOnly: true as const, providerUserId: user._id }
            : undefined;
        const off = await subscribeServiceRequests((items) => {
          if (!alive) return;
          setRequests(
            items.filter((i) => i.status !== 'completed' && i.status !== 'cancelled'),
          );
        }, filter);
        unsub = off;
      } catch (e) {
        // ignore — server unreachable; list stays empty
      }
    })();
    return () => { alive = false; unsub?.(); };
  }, [role, selectedVehicleId, requestReloadToken, user?._id]);

  /** Home inbox: only the open pending pool — never in-progress or history (same online/offline). */
  const roadsideRequests = useMemo(() => {
    const rows = requests
      .filter((r) => r.type === 'roadside')
      .filter((r) => r.status !== 'completed' && r.status !== 'cancelled');
    if (role !== 'mechanic' || !user?._id) return rows;
    return rows.filter((r) => r.status === 'pending');
  }, [requests, role, user?._id]);

  const towRequests = useMemo(() => {
    const rows = requests.filter((r) => r.type === 'tow');
    if (role !== 'tow' || !user?._id) return rows;
    return rows.filter((r) => {
      if (r.status === 'completed' || r.status === 'cancelled') return false;
      if (r.status === 'requested') return true;
      return String(r.acceptedBy ?? '') === String(user._id);
    });
  }, [requests, role, user?._id]);
  const bannerScrollRef = useRef<ScrollView>(null);

  const handleAcceptRequest = async (request: ServiceRequest) => {
    try {
      const updated = await updateServiceRequest(request._id, 'accepted');
      navigation.navigate('MechanicActiveJob', { requestId: updated._id });
    } catch (error) {
      Alert.alert('Unable to accept', extractApiError(error, 'Please try again'));
    }
  };

  const handleAcceptTowRequest = async (request: ServiceRequest) => {
    try {
      let updated: ServiceRequest;
      try {
        updated = await updateServiceRequest(request._id, 'driver_picked_hire');
      } catch {
        // Backward compatibility when backend still supports legacy "accepted" only.
        updated = await updateServiceRequest(request._id, 'accepted');
      }
      navigation.navigate('TowDriverActiveJob', { requestId: updated._id });
    } catch (error) {
      Alert.alert('Unable to accept', extractApiError(error, 'Please try again'));
    }
  };

  const navigation = useNavigation<any>();

  const openCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const openRequestChat = (request: ServiceRequest) => {
    navigation.navigate('RequestChat', {
      requestId: request._id,
      userName: request.userName,
      vehicle: request.vehicle,
      issue: request.issue,
    });
  };

  const openRequestOnMap = (request: ServiceRequest) => {
    navigation.navigate('RequestMap', {
      location: request.location,
      latitude: request.latitude,
      longitude: request.longitude,
    });
  };

  const loadLastAccessed = useCallback(async () => {
    const uid = user?._id;
    if (!uid) {
      setLastAccessedIds([]);
      return;
    }
    setLastAccessedIds(await getLastAccessedFunctions(uid));
  }, [user?._id]);

  useFocusEffect(
    useCallback(() => {
      void loadLastAccessed();
    }, [loadLastAccessed])
  );

  const runHomeFunction = useCallback(
    (id: HomeFunctionId) => {
      if (id === 'diagnose') onDiagnose();
      else if (id === 'chat') onChatAssistant();
      else onTowTruckAssistant();
    },
    [onDiagnose, onChatAssistant, onTowTruckAssistant]
  );

  const recordAndAccess = useCallback(
    (id: HomeFunctionId, fn: () => void) => () => {
      const uid = user?._id;
      if (uid) void recordHomeFunctionAccess(uid, id);
      fn();
    },
    [user?._id]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setBannerIndex(0);
    try {
      await Promise.all([refreshProfile(), refreshVehicles(), loadLastAccessed()]);
      setRequestReloadToken((t) => t + 1);
    } catch {
      // non-fatal — individual contexts keep last good state
    } finally {
      setRefreshing(false);
    }
  };

  const bannerSlideWidth = width - spacing.lg * 2;
  const bannerPageWidth = width;
  const BANNER_AUTO_SCROLL_INTERVAL = 4000;

  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % BANNER_IMAGES.length);
    }, BANNER_AUTO_SCROLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    bannerScrollRef.current?.scrollTo({
      x: bannerIndex * bannerPageWidth,
      animated: true,
    });
  }, [bannerIndex, bannerPageWidth]);

  const handleBannerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / bannerPageWidth);
    if (index >= 0 && index < BANNER_IMAGES.length) {
      setBannerIndex(index);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        scrollView: {
          flex: 1,
        },
        scrollContent: {
          paddingBottom: spacing.xl * 2,
        },
        contentPadded: {
          paddingHorizontal: spacing.lg,
        },
        header: {
          paddingVertical: spacing.xl,
        },
        greeting: {
          fontSize: fontSizes.xxxl,
          fontWeight: '700',
          color: colors.text,
        },
        subtitle: {
          fontSize: fontSizes.md,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
        rolePill: {
          alignSelf: 'flex-start',
          marginTop: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: scale(20),
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
        },
        rolePillText: {
          fontSize: fontSizes.xs,
          color: colors.primary,
          fontWeight: '500',
        },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginHorizontal: -spacing.sm,
          paddingTop: spacing.lg,
        },
        cardWrapper: {
          width: isSmallScreen ? '100%' : '50%',
          padding: spacing.sm,
          marginBottom: spacing.md,
        },
        cardWrapperFullWidth: {
          width: '100%',
          paddingHorizontal: 0,
        },
        cardContent: {
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: verticalScale(120),
        },
        cardIconWrap: {
          position: 'relative',
          marginBottom: spacing.md,
        },
        cardTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center',
        },
        heroBanner: {
          width: width,
          height: scale(220),
          marginBottom: spacing.xl,
          overflow: 'hidden',
          backgroundColor: colors.card,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        },
        heroImage: {
          width: '100%',
          height: '100%',
          resizeMode: 'cover',
        },
        heroOverlay: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: 'flex-end',
          padding: spacing.lg,
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
        },
        heroGreeting: {
          fontSize: fontSizes.xxl,
          fontWeight: '700',
          color: '#FFFFFF',
          textShadowColor: 'rgba(0, 0, 0, 0.5)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        },
        heroSubtitle: {
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: 'rgba(255, 255, 255, 0.95)',
          marginTop: spacing.xs,
          textShadowColor: 'rgba(0, 0, 0, 0.5)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        },
        videoCallButton: {
          position: 'absolute',
          bottom: spacing.lg,
          right: spacing.lg,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        },
        activitiesSection: {
          marginTop: spacing.xl,
          marginBottom: spacing.lg,
        },
        activitiesTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '700',
          color: colors.text,
          marginBottom: spacing.md,
          paddingHorizontal: spacing.lg,
        },
        activitiesList: {
          backgroundColor: colors.card,
          marginHorizontal: spacing.lg,
          borderRadius: 12,
          overflow: 'hidden',
        },
        activityRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        activityRowLast: {
          borderBottomWidth: 0,
        },
        activityIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
          position: 'relative',
        },
        activityContent: {
          flex: 1,
        },
        activityTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
        },
        activitySubtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: 2,
        },
        activityArrow: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
        },
        bannerSection: {
          marginTop: 0,
          marginBottom: spacing.md,
        },
        bannerSectionTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '700',
          color: colors.text,
          marginBottom: spacing.md,
          paddingHorizontal: spacing.lg,
        },
        bannerScroll: {
          marginBottom: spacing.sm,
        },
        bannerSlide: {
          width: width,
          height: scale(120),
          justifyContent: 'center',
          alignItems: 'center',
        },
        bannerSlideInner: {
          width: width - spacing.lg * 2,
          height: scale(120),
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: colors.border,
        },
        bannerImage: {
          width: '100%',
          height: '100%',
          resizeMode: 'cover',
        },
        bannerDots: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        },
        bannerDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.border,
          marginHorizontal: spacing.xs,
        },
        bannerDotActive: {
          width: 24,
          backgroundColor: colors.primary,
        },
        requestsCard: {
          paddingHorizontal: isSmallScreen ? spacing.md : spacing.xl,
          paddingVertical: isSmallScreen ? spacing.md : spacing.lg,
        },
        requestsCardExpanded: {
          marginHorizontal: isSmallScreen ? -spacing.xs : -spacing.sm,
        },
        requestHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: spacing.sm,
          marginBottom: spacing.lg,
        },
        requestSectionTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center',
        },
        requestSectionSubtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: spacing.xs,
          textAlign: 'center',
        },
        requestBadge: {
          minWidth: scale(28),
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.xs / 2,
          borderRadius: 999,
          backgroundColor: colors.primary + '18',
          alignItems: 'center',
          justifyContent: 'center',
        },
        requestBadgeText: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: colors.primary,
        },
        emptyRequestsContainer: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing.md,
        },
        emptyRequestsTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          marginTop: spacing.sm,
          marginBottom: spacing.xs,
        },
        requestRow: {
          paddingVertical: isSmallScreen ? spacing.sm : spacing.md,
          paddingHorizontal: isSmallScreen ? spacing.sm : spacing.md,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.sm,
          backgroundColor: colors.card,
          overflow: 'hidden',
        },
        requestRowLast: {
          marginBottom: 0,
        },
        requestRowMain: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        requestAvatar: {
          width: isSmallScreen ? 36 : 40,
          height: isSmallScreen ? 36 : 40,
          borderRadius: isSmallScreen ? 18 : 20,
          backgroundColor: colors.primary + '18',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: isSmallScreen ? spacing.sm : spacing.md,
          marginTop: 2,
          flexShrink: 0,
        },
        requestAvatarText: {
          fontSize: isSmallScreen ? fontSizes.sm : fontSizes.md,
          fontWeight: '600',
          color: colors.primary,
        },
        /** Lets long names/locations wrap correctly inside row flex (esp. web). */
        requestBody: {
          flex: 1,
          minWidth: 0,
        },
        requestCustomerName: {
          fontSize: isSmallScreen ? fontSizes.sm : fontSizes.md,
          fontWeight: '700',
          color: colors.text,
        },
        requestVehicleLine: {
          fontSize: isSmallScreen ? fontSizes.xs : fontSizes.sm,
          fontWeight: '600',
          color: colors.text,
          marginTop: spacing.xs / 2,
        },
        requestTimeMuted: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
        requestMeta: {
          fontSize: isSmallScreen ? fontSizes.xs : fontSizes.sm,
          color: colors.textSecondary,
          marginTop: spacing.xs,
          lineHeight: (isSmallScreen ? fontSizes.xs : fontSizes.sm) * 1.4,
        },
        requestBadgeRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: spacing.sm,
        },
        requestTag: {
          paddingHorizontal: isSmallScreen ? spacing.xs : spacing.sm,
          paddingVertical: spacing.xs / 2,
          borderRadius: 8,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          marginRight: spacing.xs,
          marginBottom: spacing.xs,
        },
        requestTagText: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
          color: colors.text,
        },
        requestFooterColumn: {
          marginTop: spacing.md,
          paddingTop: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        requestPhoneRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          minWidth: 0,
        },
        requestPhoneText: {
          flex: 1,
          fontSize: isSmallScreen ? fontSizes.xs : fontSizes.sm,
          color: colors.textSecondary,
          marginLeft: spacing.xs,
          minWidth: 0,
        },
        requestFooterActions: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginTop: spacing.sm,
        },
        iconActionBtn: {
          width: isSmallScreen ? 40 : 36,
          height: isSmallScreen ? 40 : 36,
          borderRadius: isSmallScreen ? 20 : 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '08',
          marginLeft: spacing.sm,
        },
        requestActions: {
          marginTop: spacing.md,
          alignSelf: 'stretch',
          width: '100%',
        },
        acceptBtn: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: 8,
          backgroundColor: colors.success,
          minWidth: 80,
          alignItems: 'center',
          alignSelf: isSmallScreen ? 'stretch' : 'flex-start',
        },
        acceptBtnText: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: '#FFFFFF',
        },
        viewMapBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.sm,
          paddingVertical: spacing.xs,
          paddingHorizontal: 0,
          alignSelf: 'flex-start',
        },
        viewMapBtnText: {
          fontSize: fontSizes.sm,
          fontWeight: '500',
          color: colors.primary,
          marginLeft: spacing.xs,
        },
        emptyRequestsText: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          textAlign: 'center',
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.sm,
        },
      }),
    [spacing, fontSizes, iconSizes, isSmallScreen, scale, width]
  );

  const items: MenuItem[] = useMemo(
    () => [
      { ...MENU_ITEMS[0], onPress: recordAndAccess('diagnose', onDiagnose) },
      { ...MENU_ITEMS[1], onPress: recordAndAccess('chat', onChatAssistant) },
      { ...MENU_ITEMS[2], onPress: recordAndAccess('tow', onTowTruckAssistant) },
    ],
    [recordAndAccess, onDiagnose, onChatAssistant, onTowTruckAssistant]
  );

  const recentRows = useMemo(() => {
    const rows: { id: HomeFunctionId; icon: IconName; title: string }[] = [];
    for (const id of lastAccessedIds) {
      const meta = MENU_ITEMS.find((m) => m.id === id);
      if (meta) rows.push({ id, icon: meta.icon, title: meta.title });
    }
    return rows;
  }, [lastAccessedIds]);

  const formatTowBookingType = (bookingType?: ServiceRequest['bookingType']) => {
    if (bookingType === 'scheduled') return 'Scheduled';
    return 'On-demand';
  };

  const formatTowAmount = (req: ServiceRequest) => {
    if (typeof req.estimatedAmount !== 'number') return null;
    return `${req.currency ?? 'LKR'} ${Math.round(req.estimatedAmount)}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.heroBanner}>
          <Image source={HERO_IMAGE} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroGreeting}>{greeting}</Text>
            <Text style={styles.heroSubtitle}>
              {role === 'mechanic'
                ? 'Manage your workshop and service jobs.'
                : role === 'tow'
                ? 'Handle live tow requests and availability.'
                : 'How can we help you today?'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.videoCallButton}
            onPress={onVideoCallPress}
            activeOpacity={0.7}
          >
            <Icon name="videocam" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

      <View style={[styles.contentPadded, styles.grid]}>
        {items.map((item) => (
          <View
            key={item.id}
            style={[styles.cardWrapper, item.id === 'tow' && styles.cardWrapperFullWidth]}
          >
            {(role === 'mechanic' || role === 'tow') && item.id === 'tow' ? (
              (() => {
                const isTow = role === 'tow';
                const mechanicOffline = !isTow && role === 'mechanic' && user?.mechanicAvailable === false;
                const sectionTitle = isTow ? 'Tow truck requests' : 'Roadside help requests';
                const requests = isTow ? towRequests : roadsideRequests;
                const onAccept = isTow
                  ? (req: ServiceRequest) => { void handleAcceptTowRequest(req); }
                  : (req: ServiceRequest) => { void handleAcceptRequest(req); };
                return (
                  <Card padded={false} style={[styles.requestsCard, styles.requestsCardExpanded]}>
                    <View style={styles.requestHeaderRow}>
                      <View>
                        <Text style={styles.requestSectionTitle}>{sectionTitle}</Text>
                        <Text style={styles.requestSectionSubtitle}>
                          Handle incoming {isTow ? 'tow' : 'roadside'} requests in real time.
                        </Text>
                      </View>
                    </View>
                    {requests.length === 0 ? (
                      <View style={styles.emptyRequestsContainer}>
                        <Icon
                          name={isTow ? 'car' : 'help-circle'}
                          size={iconSizes.lg}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.emptyRequestsTitle}>You’re all caught up</Text>
                        <Text style={styles.emptyRequestsText}>
                          {isTow
                            ? 'New tow requests will appear here instantly.'
                            : mechanicOffline
                            ? 'Turn on availability in Profile to receive new roadside requests. Finished jobs stay in Roadside help history.'
                            : 'New roadside requests will appear here instantly.'}
                        </Text>
                      </View>
                    ) : (
                      requests.map((req, index) => (
                        <View
                          key={req._id}
                          style={[
                            styles.requestRow,
                            index === requests.length - 1 && styles.requestRowLast,
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.requestRowMain}
                            activeOpacity={0.85}
                            onPress={() => openRequestOnMap(req)}
                          >
                            <View style={styles.requestAvatar}>
                              <Text style={styles.requestAvatarText}>
                                {req.userName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={styles.requestBody}>
                              <Text style={styles.requestCustomerName} numberOfLines={2}>
                                {req.userName}
                              </Text>
                              <Text style={styles.requestVehicleLine} numberOfLines={2}>
                                {req.vehicle}
                              </Text>
                              <Text style={styles.requestTimeMuted}>
                                {new Date(req.createdAt).toLocaleString()}
                              </Text>
                              <Text style={styles.requestMeta} numberOfLines={3}>
                                {req.location}
                              </Text>
                              <Text style={styles.requestMeta} numberOfLines={3}>
                                {req.issue}
                              </Text>
                              {isTow ? (
                                <>
                                  <Text style={styles.requestMeta} numberOfLines={2}>
                                    Pickup: {req.pickupAddress?.trim() || req.location}
                                  </Text>
                                  <Text style={styles.requestMeta} numberOfLines={2}>
                                    Drop: {req.dropoffAddress?.trim() || 'Not provided'}
                                  </Text>
                                  {(req.bookingType === 'scheduled' || Boolean(req.scheduledAt)) && (
                                    <Text style={styles.requestMeta} numberOfLines={2}>
                                      Scheduled for:{' '}
                                      {req.scheduledAt
                                        ? new Date(req.scheduledAt).toLocaleString()
                                        : 'Not set'}
                                    </Text>
                                  )}
                                  <View style={styles.requestBadgeRow}>
                                    <View style={styles.requestTag}>
                                      <Text style={styles.requestTagText}>Tow</Text>
                                    </View>
                                    <View style={styles.requestTag}>
                                      <Text style={styles.requestTagText}>
                                        {formatTowBookingType(req.bookingType)}
                                      </Text>
                                    </View>
                                    {formatTowAmount(req) ? (
                                      <View style={styles.requestTag}>
                                        <Text style={styles.requestTagText}>{formatTowAmount(req)}</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                </>
                              ) : (
                                <View style={styles.requestBadgeRow}>
                                  <View style={styles.requestTag}>
                                    <Text style={styles.requestTagText}>Roadside</Text>
                                  </View>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                          <View style={styles.requestActions}>
                            {isTow || req.status === 'pending' ? (
                              <TouchableOpacity
                                style={styles.acceptBtn}
                                onPress={() => onAccept(req)}
                                activeOpacity={0.9}
                              >
                                <Text style={styles.acceptBtnText}>{isTow ? 'Accept & Start' : 'Accept'}</Text>
                              </TouchableOpacity>
                            ) : (
                              <Text style={styles.requestTimeMuted}>
                                {req.status === 'accepted' ? 'Accepted by you' : `Status: ${req.status}`}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))
                    )}
                  </Card>
                );
              })()
            ) : (
              <Card onPress={item.onPress} padded>
                <View style={styles.cardContent}>
                  <View style={styles.cardIconWrap}>
                    <Icon name={item.icon} size={iconSizes.lg} color={colors.primary} />
                    <UnreadRedDot visible={hasUnreadRequestChat && item.id === 'chat'} />
                  </View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                </View>
              </Card>
            )}
          </View>
        ))}
      </View>

      {recentRows.length > 0 ? (
        <View style={styles.activitiesSection}>
          <Text style={styles.activitiesTitle}>Recently used</Text>
          <View style={styles.activitiesList}>
            {recentRows.map((row, i) => (
              <TouchableOpacity
                key={row.id}
                style={[
                  styles.activityRow,
                  i === recentRows.length - 1 && styles.activityRowLast,
                ]}
                onPress={() => {
                  const uid = user?._id;
                  if (uid) void recordHomeFunctionAccess(uid, row.id);
                  runHomeFunction(row.id);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.activityIcon}>
                  <Icon name={row.icon} size={20} color={colors.primary} />
                  <UnreadRedDot visible={hasUnreadRequestChat && row.icon === 'chatbubble'} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{row.title}</Text>
                  <Text style={styles.activitySubtitle}>Quick access</Text>
                </View>
                <Text style={styles.activityArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.bannerSection}>
        <Text style={styles.bannerSectionTitle}>News & Tips</Text>
        <ScrollView
          ref={bannerScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleBannerScroll}
          onScrollEndDrag={handleBannerScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={bannerPageWidth}
          snapToAlignment="center"
          contentContainerStyle={styles.bannerScroll}
        >
          {BANNER_IMAGES.map((source, i) => (
            <View key={i} style={styles.bannerSlide}>
              <View style={styles.bannerSlideInner}>
                <Image source={source} style={styles.bannerImage} resizeMode="cover" />
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.bannerDots}>
          {BANNER_IMAGES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.bannerDot,
                i === bannerIndex && styles.bannerDotActive,
              ]}
            />
          ))}
        </View>
      </View>
      </ScrollView>
    </View>
  );
};
