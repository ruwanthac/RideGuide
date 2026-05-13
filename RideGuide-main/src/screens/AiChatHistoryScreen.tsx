import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, HistoryDateFilterBar, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useVehicles } from '../context/VehiclesContext';
import { listAiCallHistory } from '../backend/aiCallHistoryService';
import { listAssistantChatSessions } from '../backend/assistantChatHistoryService';
import { extractApiError } from '../backend/apiClient';
import type { HistoryStackParamList } from '../types/navigation';
import { isIsoInCalendarRange } from '../utils/historyDateRange';

type Nav = NativeStackNavigationProp<HistoryStackParamList, 'AiChatHistory'>;

type MergedRow =
  | { kind: 'assistant'; id: string; sortAt: string; title: string }
  | { kind: 'video'; id: string; sortAt: string; title: string };

export const AiChatHistoryScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { spacing, fontSizes } = useResponsive();
  const { selectedVehicle, vehicles, selectedVehicleId } = useVehicles();
  const effectiveVehicleId =
    selectedVehicle?._id ??
    vehicles.find((v) => v._id === selectedVehicleId)?._id ??
    vehicles[0]?._id;
  const [rows, setRows] = useState<MergedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const vid = effectiveVehicleId ?? undefined;
    try {
      const [assistant, video] = await Promise.all([
        listAssistantChatSessions(vid),
        listAiCallHistory(vid),
      ]);
      const merged: MergedRow[] = [
        ...assistant.map((s) => ({
          kind: 'assistant' as const,
          id: s._id,
          sortAt: s.updatedAt || s.createdAt,
          title: s.previewTitle || 'AI assistant chat',
        })),
        ...video.map((v) => ({
          kind: 'video' as const,
          id: v._id,
          sortAt: v.createdAt,
          title: v.summary || 'Video AI call',
        })),
      ];
      merged.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
      setRows(merged);
    } catch (e) {
      setError(extractApiError(e));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveVehicleId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const filteredRows = useMemo(
    () => rows.filter((r) => isIsoInCalendarRange(r.sortAt, dateFrom, dateTo)),
    [rows, dateFrom, dateTo]
  );

  const hasDateFilter = dateFrom != null || dateTo != null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: spacing.xl * 2,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
        },
        back: { marginRight: spacing.md, padding: spacing.xs },
        title: { flex: 1, fontSize: fontSizes.xl, fontWeight: '700', color: colors.text },
        list: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xl * 2 },
        card: { marginBottom: spacing.md },
        badge: {
          alignSelf: 'flex-start',
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          borderRadius: 6,
          backgroundColor: '#EEF2FF',
        },
        badgeText: { fontSize: fontSizes.xs, fontWeight: '700', color: '#4338CA' },
        badgeVideo: { backgroundColor: '#ECFDF5' },
        badgeVideoText: { color: '#047857' },
        meta: { fontSize: fontSizes.xs, color: colors.textSecondary, marginBottom: spacing.xs },
        titleText: { fontSize: fontSizes.md, fontWeight: '600', color: colors.text, lineHeight: fontSizes.md * 1.35 },
        empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, fontSize: fontSizes.md },
        err: { color: '#B91C1C', marginHorizontal: spacing.lg, marginBottom: spacing.sm, fontSize: fontSizes.sm },
      }),
    [spacing, fontSizes]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Icon name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>AI chat history</Text>
      </View>
      <HistoryDateFilterBar
        from={dateFrom}
        to={dateTo}
        onChange={({ from, to }) => {
          setDateFrom(from);
          setDateTo(to);
        }}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {hasDateFilter
                ? 'Nothing in this date range. Try different dates or clear the filter.'
                : 'No AI assistant or video call history yet. Use Chat or Video call from Home.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Card
              style={styles.card}
              padded
              onPress={() => {
                if (item.kind === 'assistant') {
                  navigation.navigate('AssistantHistoryDetail', { id: item.id });
                } else {
                  navigation.navigate('AiVideoHistoryDetail', { id: item.id });
                }
              }}
            >
              <View style={[styles.badge, item.kind === 'video' && styles.badgeVideo]}>
                <Text style={[styles.badgeText, item.kind === 'video' && styles.badgeVideoText]}>
                  {item.kind === 'assistant' ? 'Assistant' : 'Video call'}
                </Text>
              </View>
              <Text style={styles.meta}>{new Date(item.sortAt).toLocaleString()}</Text>
              <Text style={styles.titleText}>{item.title}</Text>
            </Card>
          )}
        />
      )}
    </View>
  );
};
