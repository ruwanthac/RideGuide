import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Header, Card, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';

const MOCK_MECHANICS = [
  { id: '1', name: 'AutoCare Center', distance: '0.8 km', rating: '4.8', type: 'Mechanic' },
  { id: '2', name: 'QuickFix Garage', distance: '1.2 km', rating: '4.5', type: 'Tow & Mechanic' },
  { id: '3', name: 'City Auto Services', distance: '2.1 km', rating: '4.9', type: 'Mechanic' },
];

interface AssistanceScreenProps {
  onBack: () => void;
}

export const AssistanceScreen: React.FC<AssistanceScreenProps> = ({ onBack }) => {
  const { spacing, fontSizes, iconSizes, borderRadius, verticalScale } = useResponsive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { flex: 1 },
        content: {
          padding: spacing.lg,
          paddingBottom: spacing.xl * 2,
        },
        mapPlaceholder: {
          backgroundColor: colors.card,
          borderRadius: borderRadius.lg,
          padding: spacing.xl * 2,
          alignItems: 'center',
          marginBottom: spacing.xl,
          minHeight: verticalScale(180),
          borderWidth: 1,
          borderColor: colors.border,
        },
        mapIcon: { marginBottom: spacing.md },
        mapText: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
        },
        mapSubtext: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
        sectionTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.md,
        },
        mechanicCard: { marginBottom: spacing.md },
        mechanicHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
        mechanicName: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
        },
        mechanicRating: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        mechanicRatingText: {
          fontSize: fontSizes.sm,
          color: colors.primary,
          fontWeight: '600',
        },
        mechanicDistance: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
        },
        mechanicType: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
      }),
    [spacing, fontSizes, iconSizes, borderRadius, verticalScale]
  );

  return (
  <View style={styles.container}>
    <Header
        title="Roadside Help"
        showBack
        onBackPress={onBack}
        style={{ paddingTop: spacing.xl + spacing.md }}
      />

    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.mapPlaceholder}>
        <Icon name="map" size={iconSizes.xl} color={colors.primary} style={styles.mapIcon} />
        <Text style={styles.mapText}>Map View</Text>
        <Text style={styles.mapSubtext}>Your location & nearby mechanics</Text>
      </View>

      <Text style={styles.sectionTitle}>Nearby Mechanics</Text>

      {MOCK_MECHANICS.map((mechanic) => (
        <Card key={mechanic.id} onPress={() => {}} style={styles.mechanicCard} padded>
          <View style={styles.mechanicHeader}>
            <Text style={styles.mechanicName}>{mechanic.name}</Text>
            <View style={styles.mechanicRating}>
              <Icon name="star" size={iconSizes.sm} color={colors.primary} />
              <Text style={styles.mechanicRatingText}> {mechanic.rating}</Text>
            </View>
          </View>
          <Text style={styles.mechanicDistance}>{mechanic.distance} away</Text>
          <Text style={styles.mechanicType}>{mechanic.type}</Text>
        </Card>
      ))}
    </ScrollView>
  </View>
  );
};
