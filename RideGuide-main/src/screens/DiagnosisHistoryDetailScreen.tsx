import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { HistoryStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<HistoryStackParamList, 'DiagnosisHistoryDetail'>;
type R = RouteProp<HistoryStackParamList, 'DiagnosisHistoryDetail'>;

export const DiagnosisHistoryDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { entry } = route.params;
  const { spacing, fontSizes } = useResponsive();

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
        title: { flex: 1, fontSize: fontSizes.lg, fontWeight: '700', color: colors.text },
        scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
        date: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.md },
        h: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text, marginTop: spacing.md },
        body: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: fontSizes.sm * 1.45 },
        pill: {
          alignSelf: 'flex-start',
          marginTop: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: `${colors.primary}14`,
        },
        pillText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.primary, textTransform: 'capitalize' },
      }),
    [spacing, fontSizes]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Icon name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Diagnosis detail
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.date}>{new Date(entry.createdAt).toLocaleString()}</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{entry.severity}</Text>
        </View>
        <Text style={styles.h}>Symptoms</Text>
        <Text style={styles.body}>{entry.symptoms || '—'}</Text>
        {entry.obdCode ? (
          <>
            <Text style={styles.h}>OBD code</Text>
            <Text style={styles.body}>{entry.obdCode}</Text>
          </>
        ) : null}
        <Text style={styles.h}>Diagnosis</Text>
        <Text style={styles.body}>{entry.diagnosis}</Text>
        <Text style={styles.h}>Likely causes</Text>
        <Text style={styles.body}>
          {entry.likelyCauses?.length
            ? entry.likelyCauses.map((c) => `• ${c}`).join('\n')
            : '—'}
        </Text>
        <Text style={styles.h}>Steps</Text>
        <Text style={styles.body}>{entry.steps?.length ? entry.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : '—'}</Text>
        <Card style={{ marginTop: spacing.lg }} padded>
          <Text style={styles.body}>{entry.vehicleLabel}</Text>
        </Card>
      </ScrollView>
    </View>
  );
};
