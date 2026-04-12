import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Card } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useUserRole } from '../context/UserRoleContext';
import { useVehicles } from '../context/VehiclesContext';
import { useAuth } from '../context/AuthContext';
import type { Timestamp } from 'firebase/firestore';
import {
  subscribeDiagnosisHistory,
  type DiagnosisHistoryRow,
} from '../backend';

interface HistoryItem {
  id: string;
  date: string;
  symptoms: string;
  diagnosis: string;
}

const MECHANIC_HISTORY: HistoryItem[] = [
  {
    id: '1',
    date: 'Feb 10, 2025',
    symptoms: 'Service request · Toyota Prius',
    diagnosis: 'Full diagnostic completed · awaiting owner approval',
  },
  {
    id: '2',
    date: 'Feb 7, 2025',
    symptoms: 'Oil change & filter · Honda Civic',
    diagnosis: 'Job completed · payment received',
  },
  {
    id: '3',
    date: 'Feb 3, 2025',
    symptoms: 'Brake inspection · Ford Focus',
    diagnosis: 'Front pads replaced · test drive OK',
  },
];

const TOW_HISTORY: HistoryItem[] = [
  {
    id: '1',
    date: 'Feb 9, 2025',
    symptoms: 'Tow request · Highway E01',
    diagnosis: 'Vehicle delivered to Sunrise Motors',
  },
  {
    id: '2',
    date: 'Feb 6, 2025',
    symptoms: 'Battery failure · Colombo 03',
    diagnosis: 'On-site jump start · tow not required',
  },
  {
    id: '3',
    date: 'Feb 2, 2025',
    symptoms: 'Accident assistance · Kandy Road',
    diagnosis: 'Vehicle secured and moved to yard',
  },
];

function formatHistoryDate(ts: Timestamp | null): string {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function rowsToOwnerHistory(
  rows: DiagnosisHistoryRow[],
  selectedVehicleId: string
): HistoryItem[] {
  return rows
    .filter((r) => r.vehicleId === selectedVehicleId)
    .map((r) => ({
      id: r.id,
      date: formatHistoryDate(r.createdAt) || '—',
      symptoms:
        r.symptoms + (r.obdCode ? ` · OBD ${r.obdCode}` : ''),
      diagnosis: r.diagnosis,
    }));
}

interface HistoryScreenProps {
  onBack?: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const { spacing, fontSizes } = useResponsive();
  const { role } = useUserRole();
  const { vehicles, selectedVehicleId } = useVehicles();
  const { user } = useAuth();
  const [ownerRows, setOwnerRows] = useState<DiagnosisHistoryRow[]>([]);
  const [ownerLoading, setOwnerLoading] = useState(true);

  useEffect(() => {
    if (role !== 'owner' || !user?.uid) {
      setOwnerRows([]);
      setOwnerLoading(false);
      return;
    }
    setOwnerLoading(true);
    const unsub = subscribeDiagnosisHistory(
      user.uid,
      (items) => {
        setOwnerRows(items);
        setOwnerLoading(false);
      },
      () => setOwnerLoading(false)
    );
    return unsub;
  }, [role, user?.uid]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          padding: spacing.lg,
          paddingTop: spacing.xl * 2 + spacing.md,
        },
        title: {
          fontSize: fontSizes.xxl,
          fontWeight: '700',
          color: colors.text,
        },
        subtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
        list: {
          padding: spacing.lg,
          paddingTop: 0,
          paddingBottom: spacing.xl * 2,
        },
        card: { marginBottom: spacing.md },
        date: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginBottom: spacing.sm,
        },
        symptoms: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.xs,
        },
        diagnosis: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          lineHeight: fontSizes.sm * 1.4,
        },
        empty: {
          fontSize: fontSizes.md,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: spacing.xl,
        },
        loading: { marginTop: spacing.xl },
      }),
    [spacing, fontSizes]
  );

  const selectedVehicleIndex = vehicles.findIndex((v) => v.id === selectedVehicleId);
  const carLabel = selectedVehicleIndex >= 0 ? `Car ${selectedVehicleIndex + 1}` : 'Vehicle';

  const title =
    role === 'mechanic'
      ? 'Workshop History'
      : role === 'tow'
      ? 'Tow Job History'
      : 'Diagnosis History';

  const subtitle =
    role === 'mechanic'
      ? 'Completed and in-progress workshop jobs'
      : role === 'tow'
      ? 'Recent tow requests and completions'
      : role === 'owner'
      ? `${carLabel} · Your previous vehicle diagnoses`
      : 'Your previous vehicle diagnoses';

  const data: HistoryItem[] = useMemo(() => {
    if (role === 'mechanic') return MECHANIC_HISTORY;
    if (role === 'tow') return TOW_HISTORY;
    return rowsToOwnerHistory(ownerRows, selectedVehicleId);
  }, [role, ownerRows, selectedVehicleId]);

  const showOwnerEmpty =
    role === 'owner' && !ownerLoading && data.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {role === 'owner' && ownerLoading ? (
        <ActivityIndicator
          style={styles.loading}
          color={colors.primary}
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            showOwnerEmpty ? (
              <Text style={styles.empty}>
                No saved diagnoses for this vehicle yet. Run a diagnosis from Home
                to build your history.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Card style={styles.card} padded>
              <Text style={styles.date}>{item.date}</Text>
              <Text style={styles.symptoms}>{item.symptoms}</Text>
              <Text style={styles.diagnosis}>{item.diagnosis}</Text>
            </Card>
          )}
        />
      )}
    </View>
  );
};
