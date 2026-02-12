import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Card } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';

interface HistoryItem {
  id: string;
  date: string;
  symptoms: string;
  diagnosis: string;
}

const MOCK_HISTORY: HistoryItem[] = [
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

interface HistoryScreenProps {
  onBack?: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const { spacing, fontSizes } = useResponsive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: { padding: spacing.lg },
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

  return (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>Diagnosis History</Text>
      <Text style={styles.subtitle}>Your previous vehicle diagnoses</Text>
    </View>

    <FlatList
      data={MOCK_HISTORY}
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
