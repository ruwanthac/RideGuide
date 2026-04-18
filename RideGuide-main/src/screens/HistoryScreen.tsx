import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Card } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useUserRole } from '../context/UserRoleContext';
import { useVehicles } from '../context/VehiclesContext';
import { listDiagnosisHistory } from '../backend/diagnosisHistoryService';
import { listServiceRequests } from '../backend/serviceRequestsService';
import type { DiagnosisEntry, ServiceRequest } from '../backend/types';

interface HistoryItem {
  id: string;
  date: string;
  symptoms: string;
  diagnosis: string;
}


function entriesToOwnerHistory(entries: DiagnosisEntry[]): HistoryItem[] {
  return entries.map((e) => ({
    id: e._id,
    date: new Date(e.createdAt).toLocaleString(),
    symptoms: e.symptoms + (e.obdCode ? ` · OBD ${e.obdCode}` : ''),
    diagnosis: e.diagnosis,
  }));
}

interface HistoryScreenProps {
  onBack?: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const { spacing, fontSizes } = useResponsive();
  const { role } = useUserRole();
  const { vehicles, selectedVehicleId } = useVehicles();
  const [entries, setEntries] = useState<DiagnosisEntry[]>([]);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [jobs, setJobs] = useState<ServiceRequest[]>([]);

  useEffect(() => {
    if (role !== 'owner') {
      setEntries([]);
      setOwnerLoading(false);
      return;
    }
    setOwnerLoading(true);
    (async () => {
      try {
        setEntries(await listDiagnosisHistory(selectedVehicleId ?? undefined));
      } catch {
        // silent fail
      } finally {
        setOwnerLoading(false);
      }
    })();
  }, [role, selectedVehicleId]);

  useEffect(() => {
    if (role === 'owner') return;
    (async () => {
      try {
        const all = await listServiceRequests();
        setJobs(all.filter((r) => r.status === 'completed'));
      } catch {
        setJobs([]);
      }
    })();
  }, [role]);

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

  const selectedVehicleIndex = vehicles.findIndex((v) => v._id === selectedVehicleId);
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
    if (role === 'mechanic' || role === 'tow') {
      return jobs.map((r) => ({
        id: r._id,
        date: new Date(r.createdAt).toLocaleString(),
        symptoms: `${r.issue} · ${r.vehicle}`,
        diagnosis: `${r.location} · ${r.type === 'tow' ? 'Tow job' : 'Roadside job'} · ${r.userName}`,
      }));
    }
    return entriesToOwnerHistory(entries);
  }, [role, entries, jobs]);

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
