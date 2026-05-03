import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useUserRole } from '../context/UserRoleContext';
import { useVehicles } from '../context/VehiclesContext';
import { listServiceRequests } from '../backend/serviceRequestsService';
import type { ServiceRequest } from '../backend/types';
import type { HistoryStackParamList } from '../types/navigation';

type HistoryNav = NativeStackNavigationProp<HistoryStackParamList, 'History'>;

interface HistoryItem {
  id: string;
  date: string;
  symptoms: string;
  diagnosis: string;
}

interface HistoryScreenProps {
  onBack?: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const navigation = useNavigation<HistoryNav>();
  const { spacing, fontSizes } = useResponsive();
  const { role } = useUserRole();
  const { vehicles, selectedVehicleId } = useVehicles();
  const [jobs, setJobs] = useState<ServiceRequest[]>([]);

  useEffect(() => {
    if (role === 'owner' || role === 'tow') return;
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
        hubCard: { marginBottom: spacing.lg },
        hubTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
        hubDesc: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: fontSizes.sm * 1.4 },
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
        hubScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
      }),
    [spacing, fontSizes]
  );

  const selectedVehicleIndex = vehicles.findIndex((v) => v._id === selectedVehicleId);
  const carLabel = selectedVehicleIndex >= 0 ? `Car ${selectedVehicleIndex + 1}` : 'Vehicle';

  const title = role === 'mechanic' ? 'Workshop History' : 'History';

  const subtitle =
    role === 'mechanic'
      ? 'Completed and in-progress workshop jobs'
      : role === 'tow'
      ? 'Saved diagnoses and completed tow jobs'
      : role === 'owner'
      ? `${carLabel} · Tow, roadside, and saved diagnoses`
      : 'Your previous vehicle diagnoses';

  const data: HistoryItem[] = useMemo(() => {
    if (role === 'mechanic') {
      return jobs.map((r) => ({
        id: r._id,
        date: new Date(r.createdAt).toLocaleString(),
        symptoms: `${r.issue} · ${r.vehicle}`,
        diagnosis: `${r.location} · ${r.type === 'tow' ? 'Tow job' : 'Roadside job'} · ${r.userName}`,
      }));
    }
    return [];
  }, [role, jobs]);

  if (role === 'owner') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.hubScroll} showsVerticalScrollIndicator={false}>
          <Card
            style={styles.hubCard}
            padded
            onPress={() => navigation.navigate('VehicleRecordsHistory')}
          >
            <Text style={styles.hubTitle}>Vehicle records history</Text>
            <Text style={styles.hubDesc}>
              Tow truck bookings and roadside help requests for your account.
            </Text>
          </Card>
          <Card
            style={styles.hubCard}
            padded
            onPress={() => navigation.navigate('ObdDiagnoseHistory')}
          >
            <Text style={styles.hubTitle}>OBD diagnose history</Text>
            <Text style={styles.hubDesc}>
              Saved diagnoses including symptoms and OBD codes from Home.
            </Text>
          </Card>
        </ScrollView>
      </View>
    );
  }

  if (role === 'tow') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.hubScroll} showsVerticalScrollIndicator={false}>
          <Card
            style={styles.hubCard}
            padded
            onPress={() => navigation.navigate('ObdDiagnoseHistory')}
          >
            <Text style={styles.hubTitle}>OBD diagnose history</Text>
            <Text style={styles.hubDesc}>
              Saved diagnoses for this account — same as vehicle owners, including manual vehicle entries.
            </Text>
          </Card>
          <Card
            style={styles.hubCard}
            padded
            onPress={() => navigation.navigate('TowJobHistory')}
          >
            <Text style={styles.hubTitle}>Completed tow jobs</Text>
            <Text style={styles.hubDesc}>
              Tow requests you accepted and completed. Pull the list on the next screen to refresh.
            </Text>
          </Card>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No completed jobs to show yet.</Text>
        }
        renderItem={({ item }) => (
          <Card style={styles.card} padded>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.symptoms}>{item.symptoms}</Text>
            <Text style={styles.diagnosis}>{item.diagnosis}</Text>
          </Card>
        )}
      />
    </View>
  );
};
