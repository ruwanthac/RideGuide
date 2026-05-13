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
import { listServiceRequests } from '../backend/serviceRequestsService';
import { extractApiError } from '../backend/apiClient';
import type { ServiceRequest } from '../backend/types';
import type { HistoryStackParamList } from '../types/navigation';
import { navigateToTowOwnerTracking } from '../navigation/historyCrossTabNavigate';
import { isIsoInCalendarRange } from '../utils/historyDateRange';
import { formatCurrencyAmount } from '../utils/formatMoneyAmount';

type Nav = NativeStackNavigationProp<HistoryStackParamList, 'VehicleRecordsHistory'>;

type Filter = 'all' | 'tow' | 'roadside';

function statusLabel(s: ServiceRequest['status']): string {
  switch (s) {
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'pending':
    case 'requested':
      return 'Waiting';
    case 'accepted':
    case 'attending_to_location':
    case 'driver_picked_hire':
    case 'driver_on_the_way':
    case 'driver_arrived':
    case 'vehicle_in_tow':
      return 'In progress';
    default:
      return s;
  }
}

export const VehicleRecordsHistoryScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { spacing, fontSizes } = useResponsive();
  const { selectedVehicle, vehicles, selectedVehicleId } = useVehicles();
  const effectiveVehicleId =
    selectedVehicle?._id ??
    vehicles.find((v) => v._id === selectedVehicleId)?._id ??
    vehicles[0]?._id;
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const all = await listServiceRequests(
        effectiveVehicleId ? { vehicleId: effectiveVehicleId } : undefined
      );
      setRows(all);
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

  const filtered = useMemo(() => {
    let r = rows;
    if (filter === 'tow') r = r.filter((row) => row.type === 'tow');
    else if (filter === 'roadside') r = r.filter((row) => row.type === 'roadside');
    return r.filter((row) => isIsoInCalendarRange(row.createdAt, dateFrom, dateTo));
  }, [rows, filter, dateFrom, dateTo]);

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
        chips: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
        chip: {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
          borderRadius: 20,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        },
        chipActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
        chipText: { fontSize: fontSizes.sm, color: colors.textSecondary },
        chipTextActive: { color: colors.primary, fontWeight: '600' },
        list: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xl * 2 },
        card: { marginBottom: spacing.md },
        meta: { fontSize: fontSizes.xs, color: colors.textSecondary, marginBottom: spacing.xs },
        issue: { fontSize: fontSizes.md, fontWeight: '600', color: colors.text },
        sub: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
        badge: {
          alignSelf: 'flex-start',
          marginTop: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: 6,
          backgroundColor: `${colors.primary}18`,
        },
        badgeText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.primary },
        empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, fontSize: fontSizes.md },
        err: { color: '#B91C1C', marginHorizontal: spacing.lg, marginBottom: spacing.sm, fontSize: fontSizes.sm },
      }),
    [spacing, fontSizes]
  );

  const chip = (id: Filter, label: string) => (
    <TouchableOpacity
      key={id}
      style={[styles.chip, filter === id && styles.chipActive]}
      onPress={() => setFilter(id)}
    >
      <Text style={[styles.chipText, filter === id && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Icon name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Vehicle records</Text>
      </View>
      <View style={styles.chips}>
        {chip('all', 'All')}
        {chip('tow', 'Tow')}
        {chip('roadside', 'Roadside')}
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
          data={filtered}
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
                ? 'No bookings in this date range. Try different dates or clear the filter.'
                : 'No bookings for this filter yet.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Card
              style={styles.card}
              padded
              onPress={() => {
                if (item.status !== 'completed' && item.status !== 'cancelled') {
                  navigateToTowOwnerTracking(navigation, item._id);
                }
              }}
            >
              <Text style={styles.meta}>
                {new Date(item.createdAt).toLocaleString()} · {statusLabel(item.status)}
              </Text>
              <Text style={styles.issue}>{item.issue}</Text>
              <Text style={styles.sub}>{item.vehicle}</Text>
              <Text style={styles.sub}>{item.location}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.type === 'tow' ? 'Tow truck' : 'Roadside'}</Text>
              </View>
              {item.finalAmount != null || item.estimatedAmount != null ? (
                <Text style={styles.meta}>
                  {item.finalAmount != null
                    ? `Final: ${formatCurrencyAmount(item.currency, item.finalAmount)}`
                    : `Est.: ${formatCurrencyAmount(item.currency, item.estimatedAmount)}`}
                </Text>
              ) : null}
            </Card>
          )}
        />
      )}
    </View>
  );
};
