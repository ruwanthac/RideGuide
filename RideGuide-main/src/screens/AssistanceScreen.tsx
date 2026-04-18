import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { Header, Card, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { findNearbyMechanics } from '../backend/mechanicsService';
import type { AuthUser } from '../backend/types';

interface AssistanceScreenProps {
  onBack: () => void;
}

export const AssistanceScreen: React.FC<AssistanceScreenProps> = ({ onBack }) => {
  const { spacing, fontSizes, iconSizes, borderRadius, verticalScale } = useResponsive();

  const [mechanics, setMechanics] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (alive) {
            setError('Location permission needed to find nearby mechanics');
            setLoading(false);
          }
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        const list = await findNearbyMechanics({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radiusKm: 15,
          role: 'mechanic',
        });
        if (alive) {
          setMechanics(list);
          setLoading(false);
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : 'Failed to load mechanics');
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
        mechanicType: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
        mechanicAddress: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
        },
        mechanicPhone: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
        },
        statusText: {
          fontSize: fontSizes.md,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: spacing.lg,
        },
        errorText: {
          fontSize: fontSizes.md,
          color: colors.primary,
          textAlign: 'center',
          marginTop: spacing.lg,
        },
        loadingContainer: {
          alignItems: 'center',
          marginTop: spacing.lg,
        },
      }),
    [spacing, fontSizes, iconSizes, borderRadius, verticalScale]
  );

  const renderList = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>Finding nearby mechanics…</Text>
        </View>
      );
    }
    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }
    if (mechanics.length === 0) {
      return <Text style={styles.statusText}>No mechanics found nearby.</Text>;
    }
    return mechanics.map((m) => (
      <Card key={m._id} onPress={() => {}} style={styles.mechanicCard} padded>
        <View style={styles.mechanicHeader}>
          <Text style={styles.mechanicName}>
            {m.businessName ?? (m.displayName || m.email)}
          </Text>
        </View>
        {!!m.businessAddress && (
          <Text style={styles.mechanicAddress}>{m.businessAddress}</Text>
        )}
        {!!m.phoneNumber && (
          <Text style={styles.mechanicPhone}>{m.phoneNumber}</Text>
        )}
        <Text style={styles.mechanicType}>{m.role}</Text>
      </Card>
    ));
  };

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

        {renderList()}
      </ScrollView>
    </View>
  );
};
