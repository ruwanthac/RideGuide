import React, { useMemo, useState, useRef, useEffect } from 'react';
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
import { Card, Icon } from '../components';
import { colors } from '../constants/theme';
import type { IconName } from '../components';
import { useResponsive } from '../hooks';
import { useUserRole } from '../context/UserRoleContext';
import { useNavigation } from '@react-navigation/native';
import { useVehicles } from '../context/VehiclesContext';
import { useAuth } from '../context/AuthContext';
import { subscribeServiceRequests, updateServiceRequest } from '../backend/serviceRequestsService';
import type { ServiceRequest } from '../backend/types';
import { extractApiError } from '../backend/apiClient';

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

interface ActivityItem {
  id: string;
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}

const LAST_ACTIVITIES: Omit<ActivityItem, 'onPress'>[] = [
  { id: '1', icon: 'construct', title: 'Diagnosis completed', subtitle: 'Engine check' },
  { id: '2', icon: 'chatbubble', title: 'AI chat', subtitle: 'Battery question' },
  { id: '3', icon: 'car', title: 'Tow requested', subtitle: 'Quick Tow 24/7' },
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
  const { refreshProfile } = useAuth();
  const greeting = getTimeBasedGreeting();
  const [bannerIndex, setBannerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  /** Bumped on pull-to-refresh so the service-request subscription reloads from the API (resets socket listener state). */
  const [requestReloadToken, setRequestReloadToken] = useState(0);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let alive = true;
    (async () => {
      try {
        const filter = role === 'owner' && selectedVehicleId ? { vehicleId: selectedVehicleId } : undefined;
        const off = await subscribeServiceRequests((items) => {
          if (alive) setRequests(items);
        }, filter);
        unsub = off;
      } catch (e) {
        // ignore — server unreachable; list stays empty
      }
    })();
    return () => { alive = false; unsub?.(); };
  }, [role, selectedVehicleId, requestReloadToken]);

  const roadsideRequests = useMemo(
    () => requests.filter((r) => r.type === 'roadside'),
    [requests],
  );

  const towRequests = useMemo(
    () => requests.filter((r) => r.type === 'tow'),
    [requests],
  );
  const bannerScrollRef = useRef<ScrollView>(null);

  const handleAcceptRequest = (id: string) => {
    void updateServiceRequest(id, 'accepted');
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

  const onRefresh = async () => {
    setRefreshing(true);
    setBannerIndex(0);
    try {
      await Promise.all([refreshProfile(), refreshVehicles()]);
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
        },
        cardContent: {
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: verticalScale(120),
        },
        cardIcon: {
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
          padding: isSmallScreen ? spacing.sm : spacing.lg,
        },
        requestHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        },
        requestSectionTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
        },
        requestSectionSubtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: spacing.xs,
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
        },
      }),
    [spacing, fontSizes, iconSizes, isSmallScreen, scale, width]
  );

  const items: MenuItem[] = [
    { ...MENU_ITEMS[0], onPress: onDiagnose },
    { ...MENU_ITEMS[1], onPress: onChatAssistant },
    { ...MENU_ITEMS[2], onPress: onTowTruckAssistant },
  ];

  const activityHandlers: Record<string, () => void> = {
    '1': onDiagnose,
    '2': onChatAssistant,
    '3': onTowTruckAssistant,
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
                const sectionTitle = isTow ? 'Tow truck requests' : 'Roadside help requests';
                const requests = isTow ? towRequests : roadsideRequests;
                const onAccept = isTow
                  ? (req: ServiceRequest) => { void handleAcceptTowRequest(req); }
                  : (req: ServiceRequest) => { handleAcceptRequest(req._id); };
                return (
                  <Card padded={false} style={styles.requestsCard}>
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
                          New {isTow ? 'tow' : 'roadside'} requests will appear here instantly.
                        </Text>
                      </View>
                    ) : (
                      requests.map((req, index) => (
                        <TouchableOpacity
                          key={req._id}
                          style={[
                            styles.requestRow,
                            index === requests.length - 1 && styles.requestRowLast,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => openRequestOnMap(req)}
                        >
                          <View style={styles.requestRowMain}>
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
                                <View style={styles.requestBadgeRow}>
                                  <View style={styles.requestTag}>
                                    <Text style={styles.requestTagText}>Tow</Text>
                                  </View>
                                  <View style={styles.requestTag}>
                                    <Text style={styles.requestTagText}>
                                      {req.bookingType === 'scheduled' ? 'Scheduled' : 'On-demand'}
                                    </Text>
                                  </View>
                                  <View style={styles.requestTag}>
                                    <Text style={styles.requestTagText}>
                                      {req.currency ?? 'LKR'} {Math.round(req.estimatedAmount ?? 0)}
                                    </Text>
                                  </View>
                                </View>
                              ) : (
                                <View style={styles.requestBadgeRow}>
                                  <View style={styles.requestTag}>
                                    <Text style={styles.requestTagText}>Roadside</Text>
                                  </View>
                                </View>
                              )}
                            </View>
                          </View>
                          <View style={styles.requestFooterColumn}>
                            <View style={styles.requestPhoneRow}>
                              <Icon
                                name="call"
                                size={iconSizes.sm}
                                color={colors.textSecondary}
                              />
                              <Text style={styles.requestPhoneText} numberOfLines={2}>
                                {req.phoneNumber}
                              </Text>
                            </View>
                            <View style={styles.requestFooterActions}>
                              <TouchableOpacity
                                style={styles.iconActionBtn}
                                onPress={() => openCall(req.phoneNumber)}
                                activeOpacity={0.8}
                              >
                                <Icon
                                  name="call"
                                  size={iconSizes.sm}
                                  color={colors.primary}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.iconActionBtn}
                                onPress={() => openRequestChat(req)}
                                activeOpacity={0.8}
                              >
                                <Icon
                                  name="chatbubble"
                                  size={iconSizes.sm}
                                  color={colors.primary}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.iconActionBtn}
                                onPress={() => openRequestOnMap(req)}
                                activeOpacity={0.8}
                              >
                                <Icon
                                  name="map"
                                  size={iconSizes.sm}
                                  color={colors.primary}
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={styles.requestActions}>
                            <TouchableOpacity
                              style={styles.acceptBtn}
                              onPress={() => onAccept(req)}
                              activeOpacity={0.9}
                            >
                              <Text style={styles.acceptBtnText}>{isTow ? 'Accept & Start' : 'Accept'}</Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </Card>
                );
              })()
            ) : (
              <Card onPress={item.onPress} padded>
                <View style={styles.cardContent}>
                  <Icon name={item.icon} size={iconSizes.lg} color={colors.primary} style={styles.cardIcon} />
                  <Text style={styles.cardTitle}>{item.title}</Text>
                </View>
              </Card>
            )}
          </View>
        ))}
      </View>

      <View style={styles.activitiesSection}>
        <Text style={styles.activitiesTitle}>Last Activities</Text>
        <View style={styles.activitiesList}>
          {LAST_ACTIVITIES.map((activity, i) => (
            <TouchableOpacity
              key={activity.id}
              style={[
                styles.activityRow,
                i === LAST_ACTIVITIES.length - 1 && styles.activityRowLast,
              ]}
              onPress={activityHandlers[activity.id]}
              activeOpacity={0.7}
            >
              <View style={styles.activityIcon}>
                <Icon name={activity.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
              </View>
              <Text style={styles.activityArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
