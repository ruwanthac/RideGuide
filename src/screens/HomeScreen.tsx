import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  RefreshControl,
  Linking,
} from 'react-native';
import { Card, Icon } from '../components';
import { colors } from '../constants/theme';
import type { IconName } from '../components';
import { useResponsive } from '../hooks';
import { useUserRole } from '../context/UserRoleContext';
import { useNavigation } from '@react-navigation/native';

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
  onProfilePress?: () => void;
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

interface RoadsideRequest {
  id: string;
  userName: string;
  location: string;
  issue: string;
  vehicle: string;
  phoneNumber: string;
  latitude: number;
  longitude: number;
  createdAt: number;
}

const REQUEST_TTL_MS = 30 * 60 * 1000;
const now = Date.now();

const DUMMY_ROADSIDE_REQUESTS: RoadsideRequest[] = [
  { id: 'r1', userName: 'Alex', location: 'Colombo 07', issue: 'Battery dead', vehicle: 'Toyota Camry', phoneNumber: '+94771234567', latitude: 6.9271, longitude: 79.8612, createdAt: now - 2 * 60 * 1000 },
  { id: 'r2', userName: 'Sarah', location: 'Kandy Rd, Kadawata', issue: 'Flat tire', vehicle: 'Honda Civic', phoneNumber: '+94772345678', latitude: 7.0012, longitude: 79.9485, createdAt: now - 7 * 60 * 1000 },
  { id: 'r3', userName: 'James', location: 'Galle Rd, Dehiwala', issue: 'Out of fuel', vehicle: 'Nissan Leaf', phoneNumber: '+94773456789', latitude: 6.8408, longitude: 79.8631, createdAt: now - 12 * 60 * 1000 },
];

type TowRequest = RoadsideRequest;

const DUMMY_TOW_REQUESTS: TowRequest[] = [
  { id: 't1', userName: 'Maria', location: 'Nugegoda, Colombo', issue: 'Engine breakdown', vehicle: 'Mitsubishi Lancer', phoneNumber: '+94774567890', latitude: 6.8636, longitude: 79.8977, createdAt: now - 1 * 60 * 1000 },
  { id: 't2', userName: 'David', location: 'Malabe', issue: 'Transmission failure', vehicle: 'Honda Accord', phoneNumber: '+94775678901', latitude: 6.9271, longitude: 79.9632, createdAt: now - 9 * 60 * 1000 },
  { id: 't3', userName: 'Priya', location: 'Ratmalana', issue: 'Accident – need tow', vehicle: 'Suzuki Swift', phoneNumber: '+94776789012', latitude: 6.8219, longitude: 79.8865, createdAt: now - 15 * 60 * 1000 },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onDiagnose,
  onTowTruckAssistant,
  onChatAssistant,
  onProfilePress,
  onVideoCallPress,
}) => {
  const { spacing, fontSizes, iconSizes, isSmallScreen, scale, width, verticalScale } = useResponsive();
  const { role } = useUserRole();
  const greeting = getTimeBasedGreeting();
  const [quickInput, setQuickInput] = useState('');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [timeNow, setTimeNow] = useState(Date.now());
  const [roadsideRequests, setRoadsideRequests] = useState<RoadsideRequest[]>(DUMMY_ROADSIDE_REQUESTS);
  const [towRequests, setTowRequests] = useState<TowRequest[]>(DUMMY_TOW_REQUESTS);
  const bannerScrollRef = useRef<ScrollView>(null);

  const handleAcceptRequest = (id: string) => {
    setRoadsideRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAcceptTowRequest = (id: string) => {
    setTowRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const navigation = useNavigation<any>();

  const openCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const openRequestChat = (request: RoadsideRequest) => {
    navigation.navigate('RequestChat', {
      requestId: request.id,
      userName: request.userName,
      vehicle: request.vehicle,
      issue: request.issue,
    });
  };

  const openRequestOnMap = (request: RoadsideRequest) => {
    navigation.navigate('RequestMap', {
      location: request.location,
      latitude: request.latitude,
      longitude: request.longitude,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setBannerIndex(0);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
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
    const removeExpiredRequests = () => {
      const current = Date.now();
      setTimeNow(current);
      const cutoff = current - REQUEST_TTL_MS;
      setRoadsideRequests((prev) => prev.filter((r) => r.createdAt >= cutoff));
      setTowRequests((prev) => prev.filter((r) => r.createdAt >= cutoff));
    };

    removeExpiredRequests();
    const timer = setInterval(removeExpiredRequests, 15000);
    return () => clearInterval(timer);
  }, []);

  const formatRemainingTime = (createdAt: number) => {
    const remainingMs = Math.max(0, createdAt + REQUEST_TTL_MS - timeNow);
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

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
        profileIconButton: {
          position: 'absolute',
          top: spacing.xl + spacing.sm,
          right: spacing.lg,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
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
        quickInputBar: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.card,
          borderRadius: scale(24),
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        quickInput: {
          flex: 1,
          fontSize: fontSizes.md,
          color: colors.text,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          maxHeight: scale(80),
        },
        quickActionButton: {
          width: scale(40),
          height: scale(40),
          borderRadius: scale(20),
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: spacing.xs,
        },
        quickSendButton: {
          backgroundColor: colors.primary,
        },
        quickSendDisabled: {
          opacity: 0.5,
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
          padding: spacing.lg,
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
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.sm,
          backgroundColor: colors.card,
        },
        requestRowLast: {
          marginBottom: 0,
        },
        requestRowMain: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        requestAvatar: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary + '18',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.sm,
        },
        requestAvatarText: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: colors.primary,
        },
        requestInfo: {
          flex: 1,
          marginRight: spacing.sm,
        },
        requestTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
        },
        requestMeta: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: 2,
        },
        requestChip: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs / 2,
          borderRadius: 999,
          backgroundColor: colors.primary + '12',
        },
        requestChipText: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
          color: colors.primary,
        },
        requestFooterRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
        },
        requestPhoneInline: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        requestPhoneText: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginLeft: spacing.xs,
        },
        requestFooterActions: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        iconActionBtn: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '08',
          marginLeft: spacing.xs,
        },
        requestActions: {
          flexDirection: 'row',
          justifyContent: 'flex-start',
          marginTop: spacing.sm,
        },
        acceptBtn: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: 8,
          backgroundColor: colors.success,
          minWidth: 80,
          alignItems: 'center',
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

        <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ width: '100%' }}
      >
        <View style={styles.quickInputBar}>
          <TextInput
            style={styles.quickInput}
            placeholder="Ask about your vehicle..."
            placeholderTextColor={colors.textSecondary}
            value={quickInput}
            onChangeText={setQuickInput}
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {}}
            activeOpacity={0.7}
          >
            <Icon name="mic" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              styles.quickSendButton,
              !quickInput.trim() && styles.quickSendDisabled,
            ]}
            onPress={() => {
              if (quickInput.trim()) onChatAssistant();
            }}
            activeOpacity={0.7}
          >
            <Icon name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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
                const onAccept = isTow ? handleAcceptTowRequest : handleAcceptRequest;
                return (
                  <Card padded style={styles.requestsCard}>
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
                          key={req.id}
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
                            <View style={styles.requestInfo}>
                              <Text style={styles.requestTitle}>
                                {req.userName} · {req.vehicle}
                              </Text>
                              <Text style={styles.requestMeta}>{req.location}</Text>
                              <Text style={styles.requestMeta}>{req.issue}</Text>
                            </View>
                            <View style={styles.requestChip}>
                              <Text style={styles.requestChipText}>
                                {formatRemainingTime(req.createdAt)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.requestFooterRow}>
                            <View style={styles.requestPhoneInline}>
                              <Icon
                                name="call"
                                size={iconSizes.sm}
                                color={colors.textSecondary}
                              />
                              <Text style={styles.requestPhoneText}>{req.phoneNumber}</Text>
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
                              onPress={() => onAccept(req.id)}
                              activeOpacity={0.9}
                            >
                              <Text style={styles.acceptBtnText}>Accept</Text>
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
      <TouchableOpacity
        style={styles.profileIconButton}
        onPress={onProfilePress}
        activeOpacity={0.7}
      >
        <Icon name="person" size={22} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};
