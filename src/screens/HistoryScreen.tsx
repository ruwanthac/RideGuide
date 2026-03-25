import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Card } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useUserRole } from '../context/UserRoleContext';
import { useVehicles } from '../context/VehiclesContext';

interface HistoryItem {
  id: string;
  date: string;
  symptoms: string;
  diagnosis: string;
}

const OWNER_HISTORY_CAR_1: HistoryItem[] = [
  {
    id: '1',
    date: 'Feb 8, 2025',
    symptoms: 'Engine knocking sound, Check engine light',
    diagnosis: 'Possible oxygen sensor issue - P0420',
  },
  {
    id: '2',
    date: 'Feb 5, 2025',
    symptoms: 'Brake pedal feels soft',
    diagnosis: 'Brake fluid low - top up recommended',
  },
  {
    id: '3',
    date: 'Feb 1, 2025',
    symptoms: 'Battery warning light',
    diagnosis: 'Alternator or battery - tested OK',
  },
];

const OWNER_HISTORY_CAR_2: HistoryItem[] = [
  {
    id: '1',
    date: 'Mar 2, 2025',
    symptoms: 'Oil change reminder, Mileage check',
    diagnosis: 'Scheduled maintenance completed',
  },
  {
    id: '2',
    date: 'Feb 28, 2025',
    symptoms: 'Tire pressure warning',
    diagnosis: 'All tires adjusted to spec',
  },
  {
    id: '3',
    date: 'Feb 15, 2025',
    symptoms: 'AC not cooling',
    diagnosis: 'Refrigerant topped up - no leak found',
  },
];

const OWNER_HISTORY_DEFAULT: HistoryItem[] = [
  {
    id: '1',
    date: 'Recent',
    symptoms: 'No diagnoses yet',
    diagnosis: 'Run a diagnosis to see history here.',
  },
];

function getOwnerHistoryForVehicle(vehicleId: string, vehicleIndex: number): HistoryItem[] {
  if (vehicleId === 'vehicle-1') return OWNER_HISTORY_CAR_1;
  if (vehicleIndex === 1) return OWNER_HISTORY_CAR_2;
  return OWNER_HISTORY_DEFAULT;
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

interface HistoryScreenProps {
  onBack?: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const { spacing, fontSizes } = useResponsive();
  const { role } = useUserRole();
  const { vehicles, selectedVehicleId } = useVehicles();

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

  const data =
    role === 'mechanic'
      ? MECHANIC_HISTORY
      : role === 'tow'
      ? TOW_HISTORY
      : getOwnerHistoryForVehicle(
          selectedVehicleId,
          selectedVehicleIndex >= 0 ? selectedVehicleIndex : 0
        );

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
