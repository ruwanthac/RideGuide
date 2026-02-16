import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Header, Card, Icon, PrimaryButton } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';

const MOCK_TOW_SERVICES = [
  { id: '1', name: 'Quick Tow 24/7', distance: '0.5 km', rating: '4.9', eta: '15 min' },
  { id: '2', name: 'City Tow Services', distance: '1.1 km', rating: '4.6', eta: '20 min' },
  { id: '3', name: 'Highway Rescue Tow', distance: '2.3 km', rating: '4.8', eta: '25 min' },
];

interface TowTruckAssistantScreenProps {
  onBack: () => void;
}

export const TowTruckAssistantScreen: React.FC<TowTruckAssistantScreenProps> = ({ onBack }) => {
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
        heroCard: {
          borderRadius: borderRadius.lg,
          padding: spacing.xl,
          alignItems: 'center',
          marginBottom: spacing.xl,
          minHeight: verticalScale(140),
          justifyContent: 'center',
        },
        heroIcon: { marginBottom: spacing.md },
        heroTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.xs,
        },
        heroSubtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          textAlign: 'center',
        },
        requestButton: {
          marginTop: spacing.lg,
          alignSelf: 'stretch',
        },
        sectionTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.md,
        },
        towCard: { marginBottom: spacing.md },
        towHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
        towName: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
        },
        towRating: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        towRatingText: {
          fontSize: fontSizes.sm,
          color: colors.primary,
          fontWeight: '600',
        },
        towDetails: {
          flexDirection: 'row',
          marginTop: spacing.xs,
        },
        towDetail: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginRight: spacing.lg,
        },
      }),
    [spacing, fontSizes, iconSizes, borderRadius, verticalScale]
  );

  return (
    <View style={styles.container}>
      <Header
        title="Tow Truck Assistant"
        showBack
        onBackPress={onBack}
        style={{ paddingTop: spacing.xl + spacing.md }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.heroCard} padded>
          <Icon name="car" size={iconSizes.xl} color={colors.primary} style={styles.heroIcon} />
          <Text style={styles.heroTitle}>Need a tow?</Text>
          <Text style={styles.heroSubtitle}>
            Get connected to nearby tow truck services 24/7
          </Text>
          <PrimaryButton
            title="Request Tow Now"
            onPress={() => {}}
            style={styles.requestButton}
          />
        </Card>

        <Text style={styles.sectionTitle}>Nearby Tow Services</Text>

        {MOCK_TOW_SERVICES.map((service) => (
          <Card key={service.id} onPress={() => {}} style={styles.towCard} padded>
            <View style={styles.towHeader}>
              <Text style={styles.towName}>{service.name}</Text>
              <View style={styles.towRating}>
                <Icon name="star" size={iconSizes.sm} color={colors.primary} />
                <Text style={styles.towRatingText}> {service.rating}</Text>
              </View>
            </View>
            <View style={styles.towDetails}>
              <Text style={styles.towDetail}>{service.distance} away</Text>
              <Text style={styles.towDetail}>ETA: {service.eta}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
};
