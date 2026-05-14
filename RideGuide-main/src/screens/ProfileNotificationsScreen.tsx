import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useAuth } from '../context/AuthContext';
import {
  useProfileNotifications,
  type ProfileNotificationItem,
} from '../context/ProfileNotificationsContext';

interface ProfileNotificationsScreenProps {
  onBack: () => void;
}

export const ProfileNotificationsScreen: React.FC<ProfileNotificationsScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { spacing, fontSizes, borderRadius, iconSizes } = useResponsive();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { items, markAllRead } = useProfileNotifications();

  useFocusEffect(
    useCallback(() => {
      markAllRead();
    }, [markAllRead]),
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.sm),
        },
        topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
        backBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.card,
          marginRight: spacing.sm,
        },
        backIcon: { fontSize: iconSizes.md, color: colors.text },
        title: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.text, flex: 1 },
        hint: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.md },
        row: {
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        rowTitle: { fontSize: fontSizes.md, fontWeight: '600', color: colors.text },
        rowBody: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
        rowMeta: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: spacing.xs },
        unreadDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#EF4444',
          marginRight: spacing.sm,
          marginTop: 4,
        },
        rowInner: { flexDirection: 'row', alignItems: 'flex-start' },
        empty: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
      }),
    [borderRadius, colors.background, colors.card, colors.text, colors.textSecondary, fontSizes, iconSizes, insets.bottom, insets.top, spacing],
  );

  const onPressItem = useCallback(
    (item: ProfileNotificationItem) => {
      const tab = navigation.getParent?.();
      if (item.source === 'owner_accept') {
        tab?.navigate?.('HomeTab', {
          screen: item.requestType === 'tow' ? 'TowOwnerTracking' : 'RoadsideOwnerTracking',
          params: { requestId: item.requestId },
        });
      } else {
        tab?.navigate?.('HomeTab', { screen: 'Home' });
      }
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: ProfileNotificationItem }) => (
      <TouchableOpacity
        style={styles.row}
        onPress={() => onPressItem(item)}
        activeOpacity={0.7}
      >
        <View style={styles.rowInner}>
          {!item.read ? <View style={styles.unreadDot} /> : <View style={{ width: 8 + spacing.sm }} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowBody}>{item.body}</Text>
            <Text style={styles.rowMeta}>
              {new Date(item.createdAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [onPressItem, styles],
  );

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>
      <Text style={styles.hint}>
        {user?.role === 'owner'
          ? 'When a provider accepts your tow or roadside request, it appears here. Tap to open tracking.'
          : 'New jobs in your open pool appear here. Tap to go to Home and accept from the list.'}
      </Text>
      <Card padded style={{ minHeight: 200 }}>
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
          contentContainerStyle={items.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined}
        />
      </Card>
    </View>
  );
};
