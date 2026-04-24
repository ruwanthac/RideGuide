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
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
type VerificationStatus = 'submitted' | 'approved' | 'rejected';
type VerificationDocField =
  | 'businessRegistrationCopy'
  | 'companyNicCopy'
  | 'vehicleRegistrationCopy'
  | 'truckNicCopy';

interface CompanyProfile {
  name: string;
  businessRegistrationCopy: string;
  nicCopy: string;
  verificationStatus: VerificationStatus;
}

interface TowTruck {
  id: string;
  name: string;
  plate?: string;
  isActive: boolean;
  vehicleRegistrationCopy: string;
  nicCopy: string;
  verificationStatus: VerificationStatus;
}

export const TowDashboard: React.FC<TowDashboardProps> = ({ driverName }) => {
  const { spacing, fontSizes, borderRadius, scale, iconSizes } = useResponsive();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [towTrucks, setTowTrucks] = useState<TowTruck[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('truck');
  const [truckNameDraft, setTruckNameDraft] = useState('');
  const [truckPlateDraft, setTruckPlateDraft] = useState('');
  const [companyNameDraft, setCompanyNameDraft] = useState('');
  const [businessRegistrationDraft, setBusinessRegistrationDraft] = useState<string | null>(null);
  const [companyNicDraft, setCompanyNicDraft] = useState<string | null>(null);
  const [vehicleRegistrationDraft, setVehicleRegistrationDraft] = useState<string | null>(null);
  const [truckNicDraft, setTruckNicDraft] = useState<string | null>(null);
  const [truckActiveDraft, setTruckActiveDraft] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

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
        verificationBadge: {
          marginTop: spacing.xs,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs / 2,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(245,158,11,0.16)',
        },
        verificationBadgeText: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
          color: '#B45309',
        },
        docCopyText: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 2,
        },
        docUploadCard: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.background,
          padding: spacing.sm,
          marginBottom: spacing.md,
        },
        docUploadLabel: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
          color: colors.textSecondary,
          textTransform: 'uppercase',
          marginBottom: spacing.xs,
        },
        docPreviewImage: {
          width: '100%',
          height: scale(120),
          borderRadius: borderRadius.md,
          backgroundColor: colors.card,
        },
        docPreviewText: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
        docUploadActions: {
          flexDirection: 'row',
          marginTop: spacing.sm,
          alignItems: 'stretch',
        },
        docUploadActionBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: scale(44),
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.primary,
          backgroundColor: 'rgba(37,99,235,0.06)',
        },
        docUploadActionBtnSpacer: {
          width: spacing.sm,
        },
        docUploadActionIcon: {
          marginRight: spacing.xs,
        },
        docUploadActionText: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: colors.primary,
          textAlign: 'center',
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
    setBusinessRegistrationDraft(null);
    setCompanyNicDraft(null);
    setVehicleRegistrationDraft(null);
    setTruckNicDraft(null);
    setTruckActiveDraft(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
  };

  const saveDraft = () => {
    if (addMode === 'company') {
      const cleanedName = companyNameDraft.trim();
      const cleanedBusinessReg = (businessRegistrationDraft ?? '').trim();
      const cleanedNicCopy = (companyNicDraft ?? '').trim();
      if (!cleanedName || !cleanedBusinessReg || !cleanedNicCopy) return;
      setCompanyProfile({
        name: cleanedName,
        businessRegistrationCopy: cleanedBusinessReg,
        nicCopy: cleanedNicCopy,
        verificationStatus: 'submitted',
      });
      closeAddModal();
      return;
    }

    const cleanedName = truckNameDraft.trim();
    const cleanedVehicleReg = (vehicleRegistrationDraft ?? '').trim();
    const cleanedNicCopy = (truckNicDraft ?? '').trim();
    if (!cleanedName) return;
    if (!cleanedVehicleReg || !cleanedNicCopy) return;
    const cleanedPlate = truckPlateDraft.trim() || undefined;
    setTowTrucks((prev) => [
      ...prev,
      {
        id: `truck-${Date.now()}`,
        name: cleanedName,
        plate: cleanedPlate,
        isActive: truckActiveDraft,
        vehicleRegistrationCopy: cleanedVehicleReg,
        nicCopy: cleanedNicCopy,
        verificationStatus: 'submitted',
      },
    ]);
    closeAddModal();
  };

  const activeTowTrucks = towTrucks.filter((t) => t.isActive);
  const inactiveTowTrucks = towTrucks.filter((t) => !t.isActive);

  const setTruckActive = (truckId: string, nextActive: boolean) => {
    setTowTrucks((prev) =>
      prev.map((t) => (t.id === truckId ? { ...t, isActive: nextActive } : t))
    );
  };

  const renderDocUploadField = (
    label: string,
    field: VerificationDocField,
    value: string | null
  ) => (
    <View style={styles.docUploadCard}>
      <Text style={styles.docUploadLabel}>{label}</Text>
      {value ? (
        <>
          <Image source={{ uri: value }} style={styles.docPreviewImage} />
          <Text numberOfLines={1} style={styles.docPreviewText}>
            Uploaded: {value}
          </Text>
        </>
      ) : (
        <Text style={styles.docPreviewText}>No document image uploaded yet.</Text>
      )}
      <View style={styles.docUploadActions}>
        <TouchableOpacity
          style={styles.docUploadActionBtn}
          onPress={() => pickDocFromGallery(field)}
          activeOpacity={0.8}
        >
          <Icon
            name="image"
            size={iconSizes.sm}
            color={colors.primary}
            style={styles.docUploadActionIcon}
          />
          <Text numberOfLines={1} style={styles.docUploadActionText}>
            Gallery
          </Text>
        </TouchableOpacity>
        <View style={styles.docUploadActionBtnSpacer} />
        <TouchableOpacity
          style={styles.docUploadActionBtn}
          onPress={() => captureDocWithCamera(field)}
          activeOpacity={0.8}
        >
          <Icon
            name="camera"
            size={iconSizes.sm}
            color={colors.primary}
            style={styles.docUploadActionIcon}
          />
          <Text numberOfLines={1} style={styles.docUploadActionText}>
            Take Photo
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow gallery access to upload documents.');
      return false;
    }
    return true;
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to capture documents.');
      return false;
    }
    return true;
  };

  const setDocValue = (field: VerificationDocField, uri: string) => {
    switch (field) {
      case 'businessRegistrationCopy':
        setBusinessRegistrationDraft(uri);
        break;
      case 'companyNicCopy':
        setCompanyNicDraft(uri);
        break;
      case 'vehicleRegistrationCopy':
        setVehicleRegistrationDraft(uri);
        break;
      case 'truckNicCopy':
        setTruckNicDraft(uri);
        break;
    }
  };

  const pickDocFromGallery = async (field: VerificationDocField) => {
    if (!(await requestGalleryPermission())) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setDocValue(field, result.assets[0].uri);
      }
    } catch {
      Alert.alert('Upload failed', 'Unable to pick image from gallery.');
    }
  };

  const captureDocWithCamera = async (field: VerificationDocField) => {
    if (!(await requestCameraPermission())) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setDocValue(field, result.assets[0].uri);
      }
    } catch {
      Alert.alert('Capture failed', 'Unable to capture image from camera.');
    }
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
                {isAvailable
                  ? 'Live · visible to nearby drivers'
                  : 'Offline · not visible to drivers'}
              </Text>
            </View>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={setIsAvailable}
            trackColor={styles.switchTrackColor}
            thumbColor={
              isAvailable ? styles.switchThumbColor.true : styles.switchThumbColor.false
            }
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
          {companyProfile ? (
            <View>
              <Text style={styles.fleetValue}>{companyProfile.name}</Text>
              <Text style={styles.docCopyText}>
                Business registration copy: {companyProfile.businessRegistrationCopy}
              </Text>
              <Text style={styles.docCopyText}>NIC copy: {companyProfile.nicCopy}</Text>
              <View style={styles.verificationBadge}>
                <Text style={styles.verificationBadgeText}>
                  Verification {companyProfile.verificationStatus}
                </Text>
              </View>
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
            <>
              {!isAvailable ? (
                <Text style={styles.fleetEmptyText}>
                  You’re offline. Active trucks won’t be visible to nearby drivers.
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.fleetSectionLabel}>Active</Text>
                {activeTowTrucks.length === 0 ? (
                  <Text style={styles.fleetEmptyText}>No active trucks.</Text>
                ) : (
                  <View style={styles.fleetTruckList}>
                    {activeTowTrucks.map((t, idx) => (
                      <View
                        key={t.id}
                        style={[
                          styles.fleetTruckRow,
                          idx === activeTowTrucks.length - 1 &&
                            styles.fleetTruckRowLast,
                        ]}
                      >
                        <View style={{ flex: 1, paddingRight: spacing.sm }}>
                          <Text style={styles.fleetTruckName}>{t.name}</Text>
                          {t.plate ? (
                            <Text style={styles.fleetTruckPlate}>{t.plate}</Text>
                          ) : null}
                          <Text style={styles.docCopyText}>
                            Vehicle registration copy: {t.vehicleRegistrationCopy}
                          </Text>
                          <Text style={styles.docCopyText}>NIC copy: {t.nicCopy}</Text>
                          <View style={styles.verificationBadge}>
                            <Text style={styles.verificationBadgeText}>
                              Verification {t.verificationStatus}
                            </Text>
                          </View>
                        </View>
                        <Switch
                          value={true}
                          onValueChange={(v) => setTruckActive(t.id, v)}
                          trackColor={styles.switchTrackColor}
                          thumbColor={styles.switchThumbColor.true}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <Text style={styles.fleetSectionLabel}>Inactive</Text>
                {inactiveTowTrucks.length === 0 ? (
                  <Text style={styles.fleetEmptyText}>No inactive trucks.</Text>
                ) : (
                  <View style={styles.fleetTruckList}>
                    {inactiveTowTrucks.map((t, idx) => (
                      <View
                        key={t.id}
                        style={[
                          styles.fleetTruckRow,
                          idx === inactiveTowTrucks.length - 1 &&
                            styles.fleetTruckRowLast,
                        ]}
                      >
                        <View style={{ flex: 1, paddingRight: spacing.sm }}>
                          <Text style={styles.fleetTruckName}>{t.name}</Text>
                          {t.plate ? (
                            <Text style={styles.fleetTruckPlate}>{t.plate}</Text>
                          ) : null}
                          <Text style={styles.docCopyText}>
                            Vehicle registration copy: {t.vehicleRegistrationCopy}
                          </Text>
                          <Text style={styles.docCopyText}>NIC copy: {t.nicCopy}</Text>
                          <View style={styles.verificationBadge}>
                            <Text style={styles.verificationBadgeText}>
                              Verification {t.verificationStatus}
                            </Text>
                          </View>
                        </View>
                        <Switch
                          value={false}
                          onValueChange={(v) => setTruckActive(t.id, v)}
                          trackColor={styles.switchTrackColor}
                          thumbColor={styles.switchThumbColor.false}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
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
                ? 'Add company details and required verification document copies.'
                : 'Add tow truck details and required verification document copies.'}
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
                {renderDocUploadField(
                  'Business registration document copy',
                  'businessRegistrationCopy',
                  businessRegistrationDraft
                )}
                {renderDocUploadField('NIC copy', 'companyNicCopy', companyNicDraft)}
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
                {renderDocUploadField(
                  'Vehicle registration document copy',
                  'vehicleRegistrationCopy',
                  vehicleRegistrationDraft
                )}
                {renderDocUploadField('NIC copy', 'truckNicCopy', truckNicDraft)}

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: spacing.sm,
                  }}
                >
                  <Text style={[styles.modalFieldLabel, { marginBottom: 0 }]}>
                    Mark Active
                  </Text>
                  <Switch
                    value={truckActiveDraft}
                    onValueChange={setTruckActiveDraft}
                    trackColor={styles.switchTrackColor}
                    thumbColor={
                      truckActiveDraft
                        ? styles.switchThumbColor.true
                        : styles.switchThumbColor.false
                    }
                  />
                </View>
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
                        ? companyNameDraft.trim().length === 0 ||
                          !businessRegistrationDraft ||
                          !companyNicDraft
                        : truckNameDraft.trim().length === 0 ||
                          !vehicleRegistrationDraft ||
                          !truckNicDraft
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

