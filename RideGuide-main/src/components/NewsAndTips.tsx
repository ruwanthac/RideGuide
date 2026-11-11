import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Icon } from './Icon';
import { colors, shadows } from '../constants/theme';
import { useResponsive } from '../hooks';
import { tipOfTheDay } from '../constants/vehicleTips';
import { getVehicleNews, type NewsItem } from '../backend/newsService';

/** Shown when the news can't be loaded (offline, server down) so the section is never empty */
const FALLBACK_BANNERS = [
  require('../../assets/images/img1.gif'),
  require('../../assets/images/img2.gif'),
  require('../../assets/images/img3.gif'),
];
const BANNER_AUTO_SCROLL_MS = 4000;
const TIP_ACCENT = '#B45309';
const TIP_BG = '#FEF3C7';

function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

type Props = {
  /** Increment to reload the news (e.g. on pull-to-refresh) */
  refreshKey?: number;
};

export const NewsAndTips: React.FC<Props> = ({ refreshKey = 0 }) => {
  const { width, spacing, fontSizes, scale } = useResponsive();
  const tip = useMemo(() => tipOfTheDay(), [refreshKey]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let alive = true;
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    getVehicleNews()
      .then((items) => {
        if (!alive) return;
        setNews(items);
        setStatus(items.length > 0 ? 'ready' : 'failed');
      })
      .catch(() => {
        // Keep whatever was shown before; with nothing yet, fall back to the banners.
        if (alive) setStatus((s) => (s === 'ready' ? s : 'failed'));
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const openArticle = (item: NewsItem) => {
    Linking.openURL(item.link).catch(() =>
      Alert.alert("Couldn't open the article", 'Please try again later.')
    );
  };

  // Fallback banner carousel (the section's original content)
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef<ScrollView>(null);
  const showBanners = status === 'failed';
  useEffect(() => {
    if (!showBanners) return;
    const timer = setInterval(
      () => setBannerIndex((i) => (i + 1) % FALLBACK_BANNERS.length),
      BANNER_AUTO_SCROLL_MS
    );
    return () => clearInterval(timer);
  }, [showBanners]);
  useEffect(() => {
    if (showBanners) bannerRef.current?.scrollTo({ x: bannerIndex * width, animated: true });
  }, [bannerIndex, width, showBanners]);
  const onBannerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i >= 0 && i < FALLBACK_BANNERS.length) setBannerIndex(i);
  };

  const cardWidth = Math.min(Math.round(scale(250)), width - spacing.lg * 2);
  const imageHeight = Math.round(cardWidth * 0.52);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { marginBottom: spacing.md },
        sectionTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '700',
          color: colors.text,
          marginBottom: spacing.md,
          paddingHorizontal: spacing.lg,
        },
        tipCard: {
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'flex-start',
          ...shadows.sm,
        },
        tipIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: TIP_BG,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
        },
        tipLabel: {
          fontSize: fontSizes.xs,
          fontWeight: '700',
          color: TIP_ACCENT,
          letterSpacing: 0.5,
          marginBottom: 2,
        },
        tipTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text, marginBottom: 4 },
        tipText: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: Math.round(fontSizes.sm * 1.45) },
        newsHeader: {
          fontSize: fontSizes.md,
          fontWeight: '700',
          color: colors.text,
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.sm,
        },
        newsRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
        newsCard: {
          width: cardWidth,
          marginRight: spacing.md,
          backgroundColor: colors.card,
          borderRadius: 16,
          overflow: 'hidden',
          ...shadows.sm,
        },
        newsImage: { width: '100%', height: imageHeight, backgroundColor: colors.border },
        newsPlaceholder: {
          width: '100%',
          height: imageHeight,
          backgroundColor: '#DBEAFE',
          alignItems: 'center',
          justifyContent: 'center',
        },
        localBadge: {
          position: 'absolute',
          top: spacing.sm,
          left: spacing.sm,
          backgroundColor: colors.primary,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 3,
        },
        localBadgeText: { color: '#FFFFFF', fontSize: fontSizes.xs, fontWeight: '700' },
        newsBody: { padding: spacing.md },
        newsTitle: {
          fontSize: fontSizes.sm,
          fontWeight: '700',
          color: colors.text,
          lineHeight: Math.round(fontSizes.sm * 1.35),
          minHeight: Math.round(fontSizes.sm * 1.35) * 3,
        },
        newsMeta: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: spacing.sm },
        skeletonLine: { height: 12, borderRadius: 6, backgroundColor: colors.border, marginBottom: 8 },
        bannerSlide: { width, height: scale(120), justifyContent: 'center', alignItems: 'center' },
        bannerInner: {
          width: width - spacing.lg * 2,
          height: scale(120),
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: colors.border,
        },
        bannerImage: { width: '100%', height: '100%' },
        bannerDots: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
        bannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border, marginHorizontal: spacing.xs },
        bannerDotActive: { width: 24, backgroundColor: colors.primary },
      }),
    [width, spacing, fontSizes, scale, cardWidth, imageHeight]
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>News & Tips</Text>

      <View style={styles.tipCard} accessible accessibilityLabel={`Tip of the day: ${tip.title}. ${tip.text}`}>
        <View style={styles.tipIcon}>
          <Icon name="bulb" size={22} color={TIP_ACCENT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tipLabel}>TIP OF THE DAY · {tip.category.toUpperCase()}</Text>
          <Text style={styles.tipTitle}>{tip.title}</Text>
          <Text style={styles.tipText}>{tip.text}</Text>
        </View>
      </View>

      {showBanners ? (
        <View>
          <ScrollView
            ref={bannerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onBannerScroll}
          >
            {FALLBACK_BANNERS.map((source, i) => (
              <View key={i} style={styles.bannerSlide}>
                <View style={styles.bannerInner}>
                  <Image source={source} style={styles.bannerImage} resizeMode="cover" />
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.bannerDots}>
            {FALLBACK_BANNERS.map((_, i) => (
              <View key={i} style={[styles.bannerDot, i === bannerIndex && styles.bannerDotActive]} />
            ))}
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.newsHeader}>Latest vehicle news</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newsRow}>
            {status === 'loading'
              ? [0, 1].map((i) => (
                  <View key={i} style={styles.newsCard} accessibilityLabel="Loading news">
                    <View style={styles.newsImage} />
                    <View style={styles.newsBody}>
                      <View style={styles.skeletonLine} />
                      <View style={[styles.skeletonLine, { width: '70%' }]} />
                      <View style={[styles.skeletonLine, { width: '40%', marginTop: 8 }]} />
                    </View>
                  </View>
                ))
              : news.map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.newsCard, pressed && { opacity: 0.85 }]}
                    onPress={() => openArticle(item)}
                    accessibilityRole="link"
                    accessibilityLabel={`${item.title}. ${item.source}, ${timeAgo(item.publishedAt)}`}
                  >
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.newsImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.newsPlaceholder}>
                        <Icon name={item.region === 'local' ? 'map' : 'newspaper'} size={36} color={colors.primary} />
                      </View>
                    )}
                    {item.region === 'local' ? (
                      <View style={styles.localBadge}>
                        <Text style={styles.localBadgeText}>Sri Lanka</Text>
                      </View>
                    ) : null}
                    <View style={styles.newsBody}>
                      <Text style={styles.newsTitle} numberOfLines={3}>
                        {item.title}
                      </Text>
                      <Text style={styles.newsMeta} numberOfLines={1}>
                        {item.source} · {timeAgo(item.publishedAt)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
          </ScrollView>
        </>
      )}
    </View>
  );
};
