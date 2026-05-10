import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Card, PrimaryButton, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { OwnerDashboard } from '../components/dashboards/OwnerDashboard';
import { MechanicDashboard } from '../components/dashboards/MechanicDashboard';
import { TowDashboard } from '../components/dashboards/TowDashboard';
import { useUserRole } from '../context/UserRoleContext';
import { useVehicles } from '../context/VehiclesContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { extractApiError } from '../backend/apiClient';

const DEFAULT_MAKE_MODEL = 'Toyota Camry 2020';
const DEFAULT_VIN = '1HGBH41JXMN109186';
const DEFAULT_YEAR = 2020;
const DEFAULT_PLATE = 'ABC-1234';
const MAX_OWNER_VEHICLES = 3;

export const ProfileScreen: React.FC = () => {
  const { signOutUser, user } = useAuth();
  const userName = user?.displayName ?? '';
  const { spacing, fontSizes, borderRadius, buttonHeight, iconSizes, scale } =
    useResponsive();
  const { role: userRole } = useUserRole();
  const {
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    addVehicle,
    saveVehicle,
    removeVehicle,
  } = useVehicles();
  const navigation = useNavigation<any>();
  const [editMakeModel, setEditMakeModel] = useState(DEFAULT_MAKE_MODEL);
  const [editVin, setEditVin] = useState(DEFAULT_VIN);
  const [editPlate, setEditPlate] = useState(DEFAULT_PLATE);
  const [editYear, setEditYear] = useState(String(DEFAULT_YEAR));
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);

  /** Profile may point at a deleted/missing vehicle; UI falls back to first car — save must use the same id. */
  const resolvedSelectedVehicleId = useMemo(() => {
    if (vehicles.length === 0) return null;
    if (selectedVehicleId && vehicles.some((v) => v._id === selectedVehicleId)) return selectedVehicleId;
    return vehicles[0]._id;
  }, [vehicles, selectedVehicleId]);

  const currentVehicle = useMemo(() => {
    if (!resolvedSelectedVehicleId) return vehicles[0] ?? null;
    return vehicles.find((v) => v._id === resolvedSelectedVehicleId) ?? vehicles[0] ?? null;
  }, [vehicles, resolvedSelectedVehicleId]);

  useEffect(() => {
    if (!resolvedSelectedVehicleId) return;
    if (selectedVehicleId !== resolvedSelectedVehicleId) {
      void setSelectedVehicleId(resolvedSelectedVehicleId);
    }
  }, [resolvedSelectedVehicleId, selectedVehicleId, setSelectedVehicleId]);
  const currentVehicleIndex = currentVehicle
    ? vehicles.findIndex((vehicle) => vehicle._id === currentVehicle._id)
    : -1;
  const currentVehicleChipLabel =
    currentVehicleIndex >= 0 ? `Car ${currentVehicleIndex + 1}` : 'Car';
  const currentVehicleDisplay =
    currentVehicle?.makeModel?.trim()
      ? `${currentVehicleChipLabel} - ${currentVehicle.makeModel.trim()}`
      : currentVehicle?.label || 'No vehicle selected';

  const startEditingVehicle = () => {
    if (!currentVehicle) {
      Alert.alert('No vehicle', 'No vehicle found for this account yet.');
      return;
    }
    setEditMakeModel(currentVehicle.makeModel);
    setEditVin(currentVehicle.vin);
    setEditPlate((currentVehicle.plate ?? '').trim() || DEFAULT_PLATE);
    setEditYear(
      currentVehicle.year != null && Number.isFinite(Number(currentVehicle.year))
        ? String(currentVehicle.year)
        : String(DEFAULT_YEAR),
    );
    setIsEditingVehicle(true);
  };

  const cancelEditingVehicle = () => {
    setIsEditingVehicle(false);
  };

  const handleSaveVehicle = () => {
    if (!currentVehicle) {
      Alert.alert('No vehicle', 'No vehicle found to save right now.');
      return;
    }
    const makeModel = editMakeModel.trim();
    const vin = editVin.trim();
    const plate = editPlate.trim();
    const yearNum = parseInt(editYear.trim(), 10);
    if (!makeModel) {
      Alert.alert('Invalid input', 'Make & Model is required.');
      return;
    }
    if (!vin) {
      Alert.alert('Invalid input', 'VIN is required.');
      return;
    }
    if (!plate) {
      Alert.alert('Invalid input', 'Plate number is required.');
      return;
    }
    if (!Number.isFinite(yearNum) || yearNum < 1900 || yearNum > 2100) {
      Alert.alert('Invalid input', 'Enter a manufacture year between 1900 and 2100.');
      return;
    }
    void saveVehicle(currentVehicle._id, { makeModel, vin, label: makeModel, year: yearNum, plate })
      .then(() => {
        setIsEditingVehicle(false);
        Alert.alert('Saved', 'Vehicle information has been updated.');
      })
      .catch((error) => {
        Alert.alert('Could not save', extractApiError(error, 'Please try again.'));
      });
  };

  const handleAddVehicle = () => {
    if (vehicles.length >= MAX_OWNER_VEHICLES) {
      Alert.alert(
        'Vehicle limit',
        `You can add up to ${MAX_OWNER_VEHICLES} vehicles per account. Remove one to add another.`,
      );
      return;
    }
    void (async () => {
      try {
        const created = await addVehicle({
          label: DEFAULT_MAKE_MODEL,
          makeModel: DEFAULT_MAKE_MODEL,
          vin: DEFAULT_VIN,
          year: DEFAULT_YEAR,
          plate: DEFAULT_PLATE,
        });
        // Persist the new vehicle as selected before the user enters flows like AI video call.
        await setSelectedVehicleId(created._id);
        setEditMakeModel(created.makeModel);
        setEditVin(created.vin);
        setEditPlate((created.plate ?? DEFAULT_PLATE).trim() || DEFAULT_PLATE);
        setEditYear(
          created.year != null && Number.isFinite(Number(created.year))
            ? String(created.year)
            : String(DEFAULT_YEAR),
        );
        setIsEditingVehicle(true);
      } catch (e) {
        Alert.alert('Could not add vehicle', extractApiError(e, 'Please try again.'));
      }
    })();
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    if (vehicles.length <= 1) {
      Alert.alert('Cannot delete', 'You must have at least one vehicle.');
      return;
    }
    Alert.alert(
      'Delete vehicle',
      'Remove this vehicle from your list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void removeVehicle(vehicleId)
              .then(() => {
                if (isEditingVehicle && selectedVehicleId === vehicleId) {
                  setIsEditingVehicle(false);
                }
              })
              .catch(() => {
                Alert.alert('Error', 'Could not delete vehicle.');
              });
          },
        },
      ]
    );
  };

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
        headerUserBlock: {
          marginTop: spacing.md,
        },
        headerUserName: {
          fontSize: fontSizes.xxl,
          fontWeight: '700',
          color: colors.primary,
        },
        headerSelectedVehicle: {
          fontSize: fontSizes.md,
          fontWeight: '400',
          color: colors.text,
          marginTop: spacing.xs,
        },
        scroll: { flex: 1 },
        content: {
          padding: spacing.lg,
          paddingTop: 0,
          paddingBottom: spacing.xl * 2,
        },
        section: { marginBottom: spacing.lg },
        sectionTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.md,
        },
        vehicleSwitcherRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: spacing.md,
        },
        vehicleChipsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          flex: 1,
          marginRight: spacing.sm,
        },
        vehicleChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: spacing.sm,
          paddingVertical: spacing.xs,
          paddingRight: spacing.xs,
          borderRadius: borderRadius.xl,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          marginRight: spacing.xs,
          marginBottom: spacing.xs,
        },
        vehicleChipActive: {
          backgroundColor: 'rgba(37,99,235,0.08)',
          borderColor: colors.primary,
        },
        vehicleChipText: {
          fontSize: fontSizes.xs,
          color: colors.text,
          marginRight: spacing.xs,
        },
        vehicleChipTextActive: {
          color: colors.primary,
          fontWeight: '600',
        },
        vehicleChipDelete: {
          width: scale(20),
          height: scale(20),
          borderRadius: scale(10),
          backgroundColor: 'rgba(220,38,38,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        vehicleAddButton: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.xl,
          borderWidth: 1,
          borderColor: colors.primary,
          marginBottom: spacing.xs,
        },
        vehicleAddButtonDisabled: {
          opacity: 0.45,
          borderColor: colors.border,
        },
        vehicleAddButtonText: {
          fontSize: fontSizes.xs,
          color: colors.primary,
          fontWeight: '500',
        },
        infoRow: { marginBottom: spacing.sm },
        infoLabel: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginBottom: 2,
        },
        infoValue: {
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.text,
        },
        editButton: {
          marginTop: spacing.md,
          paddingVertical: spacing.sm,
        },
        editButtonText: {
          fontSize: fontSizes.sm,
          color: colors.primary,
          fontWeight: '600',
        },
        vehicleInput: {
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.text,
          backgroundColor: colors.background,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          marginTop: 2,
        },
        saveVehicleButtonWrap: {
          marginTop: spacing.md,
        },
        menuItem: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        menuItemLast: { borderBottomWidth: 0 },
        menuText: {
          fontSize: fontSizes.md,
          color: colors.text,
        },
        currentProfileText: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 2,
        },
        menuArrow: {
          fontSize: fontSizes.lg,
          color: colors.textSecondary,
          fontWeight: '300',
        },
        logoutButton: {
          marginTop: spacing.lg,
          paddingVertical: spacing.md,
          minHeight: buttonHeight,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: colors.primary,
          borderRadius: borderRadius.lg,
        },
        logoutButtonText: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.primary,
        },
        profileItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
        profileItemActive: {
          backgroundColor: 'rgba(37,99,235,0.04)',
          borderBottomColor: colors.primary,
        },
        profileItemLast: {
          borderBottomWidth: 0,
        },
        profileIcon: {
          width: scale(40),
          height: scale(40),
          borderRadius: scale(20),
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
        },
        profileInfo: {
          flex: 1,
        },
        profileName: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
        },
        profileRole: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: 2,
        },
        activeProfilePill: {
          alignSelf: 'flex-start',
          marginTop: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.xl,
          backgroundColor: 'rgba(37,99,235,0.08)',
        },
        activeProfilePillText: {
          fontSize: fontSizes.xs,
          color: colors.primary,
          fontWeight: '500',
        },
      }),
    [spacing, fontSizes, borderRadius, buttonHeight, iconSizes, scale]
  );

  const renderDashboard = () => {
    switch (userRole) {
      case 'mechanic':
        return <MechanicDashboard shopName={`${userName}'s Garage`} />;
      case 'tow':
        return <TowDashboard driverName={userName} />;
      case 'owner':
      default:
        return <OwnerDashboard />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Manage your account & vehicle</Text>
        {userRole === 'owner' ? (
          <View style={styles.headerUserBlock}>
            <Text style={styles.headerUserName}>{userName}</Text>
            <Text style={styles.headerSelectedVehicle} numberOfLines={2}>
              {currentVehicleDisplay}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderDashboard()}

        {userRole === 'owner' && (
          <Card style={styles.section} padded>
            <Text style={styles.sectionTitle}>Vehicle Info</Text>
            <Text style={[styles.currentProfileText, { marginBottom: spacing.sm }]}>
              Up to {MAX_OWNER_VEHICLES} vehicles per account. Plate and manufacture year are required and shown to
              support staff.
            </Text>

            <View style={styles.vehicleSwitcherRow}>
              <View style={styles.vehicleChipsContainer}>
                {vehicles.map((vehicle, index) => {
                  const isActive = vehicle._id === resolvedSelectedVehicleId;
                  const canDelete = vehicles.length > 1;
                  const displayLabel = `Car ${index + 1}`;
                  return (
                    <View
                      key={vehicle._id}
                      style={[
                        styles.vehicleChip,
                        isActive && styles.vehicleChipActive,
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          void setSelectedVehicleId(vehicle._id);
                          if (isEditingVehicle) {
                            setIsEditingVehicle(false);
                          }
                        }}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Text
                          style={[
                            styles.vehicleChipText,
                            isActive && styles.vehicleChipTextActive,
                          ]}
                        >
                          {displayLabel}
                        </Text>
                      </TouchableOpacity>
                      {canDelete && (
                        <TouchableOpacity
                          style={styles.vehicleChipDelete}
                          onPress={() => handleDeleteVehicle(vehicle._id)}
                          activeOpacity={0.7}
                        >
                          <Icon name="close" size={12} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[
                  styles.vehicleAddButton,
                  vehicles.length >= MAX_OWNER_VEHICLES && styles.vehicleAddButtonDisabled,
                ]}
                onPress={handleAddVehicle}
                activeOpacity={vehicles.length >= MAX_OWNER_VEHICLES ? 1 : 0.7}
                disabled={vehicles.length >= MAX_OWNER_VEHICLES}
              >
                <Text style={styles.vehicleAddButtonText}>+ Add vehicle</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Make & Model</Text>
              {isEditingVehicle ? (
                <TextInput
                  style={styles.vehicleInput}
                  value={editMakeModel}
                  onChangeText={setEditMakeModel}
                  placeholder="e.g. Toyota Camry 2020"
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={styles.infoValue}>
                  {currentVehicle?.makeModel || 'Not set'}
                </Text>
              )}
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>VIN</Text>
              {isEditingVehicle ? (
                <TextInput
                  style={styles.vehicleInput}
                  value={editVin}
                  onChangeText={setEditVin}
                  placeholder="e.g. 1HGBH41JXMN109186"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                />
              ) : (
                <Text style={styles.infoValue}>
                  {currentVehicle?.vin || 'Not set'}
                </Text>
              )}
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Plate number</Text>
              {isEditingVehicle ? (
                <TextInput
                  style={styles.vehicleInput}
                  value={editPlate}
                  onChangeText={(t) => setEditPlate(t.slice(0, 24))}
                  placeholder="e.g. CAB-1234"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                />
              ) : (
                <Text style={styles.infoValue}>{currentVehicle?.plate?.trim() || 'Not set'}</Text>
              )}
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Manufacture year</Text>
              {isEditingVehicle ? (
                <TextInput
                  style={styles.vehicleInput}
                  value={editYear}
                  onChangeText={setEditYear}
                  placeholder="e.g. 2020"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              ) : (
                <Text style={styles.infoValue}>
                  {currentVehicle?.year != null ? String(currentVehicle.year) : 'Not set'}
                </Text>
              )}
            </View>
            {isEditingVehicle ? (
              <View style={styles.saveVehicleButtonWrap}>
                <PrimaryButton title="Save" onPress={handleSaveVehicle} />
                <TouchableOpacity
                  style={[styles.editButton, { marginTop: spacing.sm }]}
                  onPress={cancelEditingVehicle}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.editButtonText, { color: colors.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.editButton}
                onPress={startEditingVehicle}
                activeOpacity={0.7}
              >
                <Text style={styles.editButtonText}>Edit Vehicle</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        <Card style={styles.section} padded>
        <Text style={styles.sectionTitle}>Settings</Text>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Notifications</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.menuItem, userRole !== 'admin' && styles.menuItemLast]}
          onPress={() => navigation.navigate('Privacy' as never)}
          activeOpacity={0.7}
        >
          <Text style={styles.menuText}>Privacy</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        {userRole === 'admin' && (
          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => navigation.navigate('Admin' as never)} activeOpacity={0.7}>
            <Text style={styles.menuText}>Admin Dashboard</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        )}
        </Card>

        <Card style={styles.section} padded>
          <Text style={styles.sectionTitle}>Account type</Text>
          <Text style={styles.currentProfileText}>
            {userRole === 'mechanic'
              ? 'You are signed in as a mechanic. Vehicle owner and tow features use separate accounts.'
              : userRole === 'tow'
              ? 'You are signed in as a tow truck driver. Owner and mechanic features use separate accounts.'
              : userRole === 'admin'
              ? 'Administrator account.'
              : 'You are signed in as a vehicle owner. Mechanic and tow driver features use separate accounts.'}
          </Text>
          <Text style={[styles.currentProfileText, { marginTop: spacing.sm, opacity: 0.85 }]}>
            To use another role, log out and create a new account with a different email (or sign in to that account).
          </Text>
        </Card>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => void signOutUser()}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
