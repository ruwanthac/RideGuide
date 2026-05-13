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
import { isIsoInCalendarRange } from '../utils/historyDateRange';
import { listServiceRequests } from '../backend/serviceRequestsService';
import { extractApiError } from '../backend/apiClient';
import type { ServiceRequest } from '../backend/types';
import type { HistoryStackParamList } from '../types/navigation';
import { formatCurrencyAmount } from '../utils/formatMoneyAmount';

type Nav = NativeStackNavigationProp<HistoryStackParamList, 'RoadsideHelpHistory'>;

export const RoadsideHelpHistoryScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { spacing, fontSizes } = useResponsive();
  const [jobs, setJobs] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await listServiceRequests({ history: true });
      setJobs(rows.filter((r) => r.type === 'roadside' && r.status === 'completed'));
    } catch (e) {
      setError(extractApiError(e));
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const filteredJobs = useMemo(
    () => jobs.filter((j) => isIsoInCalendarRange(j.createdAt, dateFrom, dateTo)),
    [jobs, dateFrom, dateTo]
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
        sub: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.md,
        },
        list: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xl * 2 },
        card: { marginBottom: spacing.md },
        date: { fontSize: fontSizes.xs, color: colors.textSecondary, marginBottom: spacing.sm },
        line: { fontSize: fontSizes.md, fontWeight: '600', color: colors.text },
        meta: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: spacing.xs,
          lineHeight: fontSizes.sm * 1.35,
        },
        empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, fontSize: fontSizes.md },
        err: { color: colors.error, marginHorizontal: spacing.lg, marginBottom: spacing.sm, fontSize: fontSizes.sm },
      }),
    [spacing, fontSizes]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Icon name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Roadside help history</Text>
      </View>
      <Text style={styles.sub}>Only roadside requests marked completed are shown here.</Text>
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
          data={filteredJobs}
          keyExtractor={(item) => item._id}
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
                ? 'No roadside jobs in this date range. Try different dates or clear the filter.'
                : 'No completed roadside jobs yet.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Card style={styles.card} padded>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
              <Text style={styles.line}>
                {item.userName} · {item.vehicle}
              </Text>
              <Text style={styles.meta}>{item.issue}</Text>
              <Text style={styles.meta}>{item.pickupAddress ?? item.location}</Text>
              {item.finalAmount != null ? (
                <Text style={styles.meta}>
                  Final: {formatCurrencyAmount(item.currency, item.finalAmount)}
                </Text>
              ) : item.estimatedAmount != null ? (
                <Text style={styles.meta}>
                  Est.: {formatCurrencyAmount(item.currency, item.estimatedAmount)}
                </Text>
              ) : null}
            </Card>
          )}
        />
      )}
    </View>
  );
};
