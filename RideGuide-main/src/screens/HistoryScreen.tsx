import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useUserRole } from '../context/UserRoleContext';
import type { HistoryStackParamList } from '../types/navigation';

type HistoryNav = NativeStackNavigationProp<HistoryStackParamList, 'History'>;

interface HistoryScreenProps {
  onBack?: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const navigation = useNavigation<HistoryNav>();
  const { spacing, fontSizes } = useResponsive();
  const { role } = useUserRole();

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
        hubCard: { marginBottom: spacing.lg },
        hubTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
        hubDesc: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: fontSizes.sm * 1.4 },
        hubScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
      }),
    [spacing, fontSizes]
  );

  const carLabel = 'Vehicle';

  const title = role === 'mechanic' ? 'Workshop History' : 'History';

  const subtitle =
    role === 'mechanic'
      ? 'Open your diagnosis and completed roadside job history.'
      : role === 'tow'
      ? 'Saved diagnoses and completed tow jobs'
      : role === 'owner'
      ? `${carLabel} · Tow, roadside, and saved diagnoses`
      : 'Your previous vehicle diagnoses';

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
      <ScrollView contentContainerStyle={styles.hubScroll} showsVerticalScrollIndicator={false}>
        <Card
          style={styles.hubCard}
          padded
          onPress={() => navigation.navigate('ObdDiagnoseHistory')}
        >
          <Text style={styles.hubTitle}>Diagnose history</Text>
          <Text style={styles.hubDesc}>
            Saved diagnostic sessions for this mechanic account.
          </Text>
        </Card>
        <Card
          style={styles.hubCard}
          padded
          onPress={() => navigation.navigate('RoadsideHelpHistory')}
        >
          <Text style={styles.hubTitle}>Roadside help history</Text>
          <Text style={styles.hubDesc}>
            Only completed roadside help jobs are listed.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
};
