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
} from 'react-native';
import { Card, Icon } from '../components';
import { colors } from '../constants/theme';
import type { IconName } from '../components';
import { useResponsive } from '../hooks';

interface MenuItem {
  id: string;
  icon: IconName;
  title: string;
  onPress: () => void;
}

interface HomeScreenProps {
  onDiagnose: () => void;
  onCameraUpload: () => void;
  onChatAssistant: () => void;
  onAssistance: () => void;
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
  { id: 'camera', icon: 'camera', title: 'Upload Vehicle Image' },
  { id: 'chat', icon: 'chatbubble', title: 'AI Assistant' },
  { id: 'help', icon: 'help-circle', title: 'Roadside Help' },
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
  { id: '2', icon: 'camera', title: 'Image analyzed', subtitle: 'Brake pads' },
  { id: '3', icon: 'chatbubble', title: 'AI chat', subtitle: 'Battery question' },
  { id: '4', icon: 'help-circle', title: 'Roadside request', subtitle: 'Flat tire' },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onDiagnose,
  onCameraUpload,
  onChatAssistant,
  onAssistance,
  onProfilePress,
  onVideoCallPress,
}) => {
  const { spacing, fontSizes, iconSizes, isSmallScreen, scale, width } = useResponsive();
  const greeting = getTimeBasedGreeting();
  const [quickInput, setQuickInput] = useState('');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const bannerScrollRef = useRef<ScrollView>(null);

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
        cardIcon: {
          marginBottom: spacing.md,
        },
        cardTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
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
      }),
    [spacing, fontSizes, iconSizes, isSmallScreen, scale, width]
  );

  const items: MenuItem[] = [
    { ...MENU_ITEMS[0], onPress: onDiagnose },
    { ...MENU_ITEMS[1], onPress: onCameraUpload },
    { ...MENU_ITEMS[2], onPress: onChatAssistant },
    { ...MENU_ITEMS[3], onPress: onAssistance },
  ];

  const activityHandlers: Record<string, () => void> = {
    '1': onDiagnose,
    '2': onCameraUpload,
    '3': onChatAssistant,
    '4': onAssistance,
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
          <Text style={styles.heroSubtitle}>How can we help you today?</Text>
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
          <View key={item.id} style={styles.cardWrapper}>
            <Card onPress={item.onPress} padded>
              <Icon name={item.icon} size={iconSizes.lg} color={colors.primary} style={styles.cardIcon} />
              <Text style={styles.cardTitle}>{item.title}</Text>
            </Card>
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
