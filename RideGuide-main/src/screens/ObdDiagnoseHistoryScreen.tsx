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
import { Card, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useVehicles } from '../context/VehiclesContext';
import { listDiagnosisHistory } from '../backend/diagnosisHistoryService';
import { extractApiError } from '../backend/apiClient';
import type { DiagnosisEntry } from '../backend/types';
import type { HistoryStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<HistoryStackParamList, 'ObdDiagnoseHistory'>;

export const ObdDiagnoseHistoryScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { spacing, fontSizes } = useResponsive();
  const { selectedVehicle, vehicles, selectedVehicleId } = useVehicles();
  const effectiveVehicleId =
    selectedVehicle?._id ??
    vehicles.find((v) => v._id === selectedVehicleId)?._id ??
    vehicles[0]?._id;
  const [entries, setEntries] = useState<DiagnosisEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries(await listDiagnosisHistory(effectiveVehicleId ?? undefined));
    } catch (e) {
      setError(extractApiError(e));
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveVehicleId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

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
        date: { fontSize: fontSizes.xs, color: colors.textSecondary, marginBottom: spacing.xs },
        line: { fontSize: fontSizes.md, fontWeight: '600', color: colors.text },
        preview: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: fontSizes.sm * 1.35 },
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
        <Text style={styles.title}>OBD diagnose history</Text>
      </View>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlatList
          data={entries}
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
            <Text style={styles.empty}>No saved diagnoses for this vehicle yet. Run a diagnosis from Home.</Text>
          }
          renderItem={({ item }) => (
            <Card
              style={styles.card}
              padded
              onPress={() => navigation.navigate('DiagnosisHistoryDetail', { entry: item })}
            >
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
              <Text style={styles.line}>
                {item.symptoms}
                {item.obdCode ? ` · OBD ${item.obdCode}` : ''}
              </Text>
              <Text style={styles.preview} numberOfLines={3}>
                {item.diagnosis}
              </Text>
            </Card>
          )}
        />
      )}
    </View>
  );
};
