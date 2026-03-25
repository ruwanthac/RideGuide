import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Animated,
  Easing,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, PrimaryButton } from '../';
import { colors } from '../../constants/theme';
import { useResponsive } from '../../hooks';
import { Icon } from '../Icon';

interface TowDashboardProps {
  driverName?: string;
}

const DUMMY_ACTIVE_REQUESTS = 2;
const DUMMY_COMPLETED_JOBS = 14;
const DUMMY_LOCATION = 'Near Colombo 07';

type AddMode = 'company' | 'truck';

export const TowDashboard: React.FC<TowDashboardProps> = ({ driverName }) => {
  const { spacing, fontSizes, borderRadius, scale, iconSizes } = useResponsive();
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [companyName, setCompanyName] = useState<string>('');
  const [towTrucks, setTowTrucks] = useState<Array<{ id: string; name: string; plate?: string }>>(
    []
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('truck');
  const [truckNameDraft, setTruckNameDraft] = useState('');
  const [truckPlateDraft, setTruckPlateDraft] = useState('');
  const [companyNameDraft, setCompanyNameDraft] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginBottom: spacing.lg,
        },
        sectionTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.md,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        statusBlock: {
          flex: 1,
          marginRight: spacing.md,
        },
        statusTitle: {
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.text,
        },
        statusSubtitle: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 2,
        },
        availabilityPill: {
          marginTop: spacing.sm,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(37,99,235,0.08)',
        },
        availabilityPillText: {
          fontSize: fontSizes.xs,
          color: colors.primary,
          fontWeight: '500',
        },
        metricRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        metricCard: {
          flex: 1,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.lg,
          backgroundColor: 'rgba(15,23,42,0.02)',
        },
        metricSpacer: {
          width: spacing.sm,
        },
        metricLabel: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
        },
        metricValue: {
          fontSize: fontSizes.xxl,
          fontWeight: '700',
          color: colors.text,
          marginTop: 2,
        },
        metricCaption: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 4,
        },
        locationRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        locationLabelBlock: {
          flex: 1,
        },
        locationLabel: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
        },
        locationValue: {
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.text,
          marginTop: 2,
        },
        locationStatusDot: {
          width: scale(10),
          height: scale(10),
          borderRadius: borderRadius.full,
          backgroundColor: colors.success,
          marginLeft: spacing.sm,
        },
        subtleDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginVertical: spacing.md,
        },
        hintText: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
        },
        activitiesButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.primary,
          borderRadius: borderRadius.lg,
        },
        activitiesButtonText: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: '#FFFFFF',
          marginLeft: spacing.sm,
        },
        switchTrackColor: {
          false: 'rgba(156,163,175,0.32)',
          true: 'rgba(37,99,235,0.32)',
        } as { false: string; true: string },
        switchThumbColor: {
          false: '#FFFFFF',
          true: colors.primary,
        } as { false: string; true: string },

        fleetCardTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        },
        fleetCardTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
        },
        fleetSection: {
          marginBottom: spacing.lg,
        },
        fleetSectionLabel: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          fontWeight: '600',
          marginBottom: spacing.xs,
          textTransform: 'uppercase',
        },
        fleetValue: {
          fontSize: fontSizes.md,
          color: colors.text,
          fontWeight: '600',
        },
        fleetEmptyText: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
        },
        fleetTruckList: {
          marginTop: spacing.sm,
        },
        fleetTruckRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        fleetTruckRowLast: {
          borderBottomWidth: 0,
        },
        fleetTruckName: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: colors.text,
        },
        fleetTruckPlate: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 2,
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        },
        modalSheet: {
          width: '100%',
          backgroundColor: colors.card,
          borderRadius: borderRadius.xl,
          padding: spacing.lg,
        },
        modalTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '700',
          color: colors.text,
          marginBottom: spacing.xs,
        },
        modalSubtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginBottom: spacing.md,
        },
        modalFieldLabel: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          fontWeight: '600',
          marginBottom: spacing.xs,
          textTransform: 'uppercase',
        },
        modalInput: {
          backgroundColor: colors.background,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.text,
          marginBottom: spacing.md,
        },
        modalActions: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: spacing.md,
        },
        modalCancelBtn: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
        modalCancelText: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center',
        },
      }),
    [borderRadius, fontSizes, scale, spacing, iconSizes]
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const openAddModal = (mode: AddMode) => {
    setAddMode(mode);
    setIsAddModalOpen(true);
    setTruckNameDraft('');
    setTruckPlateDraft('');
    setCompanyNameDraft('');
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
  };

  const saveDraft = () => {
    if (addMode === 'company') {
      const cleaned = companyNameDraft.trim();
      if (!cleaned) return;
      setCompanyName(cleaned);
      closeAddModal();
      return;
    }

    const cleanedName = truckNameDraft.trim();
    if (!cleanedName) return;
    const cleanedPlate = truckPlateDraft.trim() || undefined;
    setTowTrucks((prev) => [
      ...prev,
      { id: `truck-${Date.now()}`, name: cleanedName, plate: cleanedPlate },
    ]);
    closeAddModal();
  };

  return (
    <Animated.View
      style={{
        marginBottom: spacing.lg,
        opacity: fadeAnim,
        transform: [
          {
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      <Text style={styles.sectionTitle}>Tow Dashboard</Text>

      <Card style={{ marginBottom: spacing.md }} padded>
        <View style={styles.row}>
          <View style={styles.statusBlock}>
            <Text style={styles.statusTitle}>
              {driverName || 'You are live'}
            </Text>
            <Text style={styles.statusSubtitle}>
              Control your availability for new tow requests.
            </Text>
            <View className="availability-pill" style={styles.availabilityPill}>
              <Text style={styles.availabilityPillText}>
                Live · visible to nearby drivers
              </Text>
            </View>
          </View>
          <Switch
            value
            trackColor={styles.switchTrackColor}
            thumbColor={styles.switchThumbColor.true}
          />
        </View>
      </Card>

      <Card style={{ marginBottom: spacing.md }} padded>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Active requests</Text>
            <Text style={styles.metricValue}>{DUMMY_ACTIVE_REQUESTS}</Text>
            <Text style={styles.metricCaption}>Assigned to you</Text>
          </View>
          <View style={styles.metricSpacer} />
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Completed jobs</Text>
            <Text style={styles.metricValue}>{DUMMY_COMPLETED_JOBS}</Text>
            <Text style={styles.metricCaption}>Last 30 days</Text>
          </View>
        </View>
      </Card>

      <Card style={{ marginBottom: spacing.md }} padded>
        <TouchableOpacity
          style={styles.activitiesButton}
          onPress={() => navigation.navigate('Activities')}
          activeOpacity={0.8}
        >
          <Icon name="document-text" size={iconSizes.md} color="#FFFFFF" />
          <Text style={styles.activitiesButtonText}>Your activities</Text>
        </TouchableOpacity>
      </Card>

      <Card padded>
        <View style={styles.locationRow}>
          <View style={styles.locationLabelBlock}>
            <Text style={styles.locationLabel}>Current location status</Text>
            <Text style={styles.locationValue}>{DUMMY_LOCATION}</Text>
          </View>
          <View style={styles.locationStatusDot} />
        </View>
        <View style={styles.subtleDivider} />
        <Text style={styles.hintText}>
          Location is shared only while you are available. You can change this
          anytime from Settings.
        </Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }} padded>
        <View style={styles.fleetCardTitleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="car" size={iconSizes.lg} color={colors.primary} />
            <Text style={[styles.fleetCardTitle, { marginLeft: spacing.sm }]}>
              Your Tow Fleet
            </Text>
          </View>
        </View>

        <View style={styles.fleetSection}>
          <Text style={styles.fleetSectionLabel}>Company</Text>
          {companyName ? (
            <View>
              <Text style={styles.fleetValue}>{companyName}</Text>
              <Text style={styles.fleetEmptyText}>
                You can update this by adding a new company.
              </Text>
            </View>
          ) : (
            <Text style={styles.fleetEmptyText}>No company added yet.</Text>
          )}
        </View>

        <View style={styles.fleetSection}>
          <Text style={styles.fleetSectionLabel}>Tow Trucks</Text>
          {towTrucks.length === 0 ? (
            <Text style={styles.fleetEmptyText}>No tow trucks added yet.</Text>
          ) : (
            <View style={styles.fleetTruckList}>
              {towTrucks.map((t, idx) => (
                <View
                  key={t.id}
                  style={[
                    styles.fleetTruckRow,
                    idx === towTrucks.length - 1 && styles.fleetTruckRowLast,
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: spacing.sm }}>
                    <Text style={styles.fleetTruckName}>{t.name}</Text>
                    {t.plate ? <Text style={styles.fleetTruckPlate}>{t.plate}</Text> : null}
                  </View>
                  <Icon name="map" size={iconSizes.sm} color={colors.textSecondary} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <PrimaryButton title="Add Tow Truck" onPress={() => openAddModal('truck')} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton title="Add Company" onPress={() => openAddModal('company')} />
          </View>
        </View>
      </Card>

      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAddModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {addMode === 'company' ? 'Add Tow Company' : 'Add Tow Truck'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {addMode === 'company'
                ? 'Add your company name so nearby drivers know who to contact.'
                : 'Add a tow truck for your fleet. You can include a plate/identifier.'}
            </Text>

            {addMode === 'company' ? (
              <>
                <Text style={styles.modalFieldLabel}>Company Name</Text>
                <TextInput
                  value={companyNameDraft}
                  onChangeText={setCompanyNameDraft}
                  placeholder="e.g. Colombo Tow Services"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.modalInput}
                  autoCapitalize="words"
                />
              </>
            ) : (
              <>
                <Text style={styles.modalFieldLabel}>Truck Name</Text>
                <TextInput
                  value={truckNameDraft}
                  onChangeText={setTruckNameDraft}
                  placeholder="e.g. Tow Truck A"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.modalInput}
                  autoCapitalize="words"
                />
                <Text style={styles.modalFieldLabel}>Plate / Identifier (optional)</Text>
                <TextInput
                  value={truckPlateDraft}
                  onChangeText={setTruckPlateDraft}
                  placeholder="e.g. WP-1234"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.modalInput}
                  autoCapitalize="characters"
                />
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={closeAddModal}
                activeOpacity={0.8}
              >
                <View style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={saveDraft}
                activeOpacity={0.8}
              >
                <View>
                  <PrimaryButton
                    title="Save"
                    onPress={saveDraft}
                    disabled={
                      addMode === 'company'
                        ? companyNameDraft.trim().length === 0
                        : truckNameDraft.trim().length === 0
                    }
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

