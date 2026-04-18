import React, { useMemo, useState } from 'react';
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
import type { UserRole } from '../backend/types';
import { useVehicles } from '../context/VehiclesContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

const DEFAULT_MAKE_MODEL = 'Toyota Camry 2020';
const DEFAULT_VIN = '1HGBH41JXMN109186';

export const ProfileScreen: React.FC = () => {
  const { signOutUser, user } = useAuth();
  const userName = user?.displayName ?? '';
  const { spacing, fontSizes, borderRadius, buttonHeight, iconSizes, scale } =
    useResponsive();
  const { role: userRole, setRole: setUserRole } = useUserRole();
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
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);

  const currentVehicle = vehicles.find((v) => v._id === selectedVehicleId) ?? vehicles[0];
  const currentVehicleDisplay =
    currentVehicle?.makeModel?.trim() ||
    currentVehicle?.label ||
    'No vehicle selected';

  const startEditingVehicle = () => {
    if (!currentVehicle) {
      Alert.alert('No vehicle', 'No vehicle found for this account yet.');
      return;
    }
    setEditMakeModel(currentVehicle.makeModel);
    setEditVin(currentVehicle.vin);
    setIsEditingVehicle(true);
  };

  const handleManageProfiles = () => {
    setShowProfiles(!showProfiles);
  };

  const handleSelectProfile = (role: UserRole) => {
    const label =
      role === 'mechanic' ? 'Mechanic' : role === 'tow' ? 'Tow Truck Driver' : 'Owner';
    setUserRole(role);
    setShowProfiles(false);
    Alert.alert('Profile Selected', `Switched to ${label} profile`, [
      {
        text: 'OK',
        onPress: () => {
          if (role === 'owner' || role === 'mechanic' || role === 'tow') {
            navigation.getParent()?.navigate('HomeTab');
          }
        },
      },
    ]);
  };

  const cancelEditingVehicle = () => {
    setIsEditingVehicle(false);
  };

  const handleSaveVehicle = () => {
    if (!currentVehicle || !selectedVehicleId) {
      Alert.alert('No vehicle', 'No vehicle found to save right now.');
      return;
    }
    if (!editMakeModel.trim()) {
      Alert.alert('Invalid input', 'Make & Model is required.');
      return;
    }
    void saveVehicle(selectedVehicleId, { makeModel: editMakeModel, vin: editVin })
      .then(() => {
        setIsEditingVehicle(false);
        Alert.alert('Saved', 'Vehicle information has been updated.');
      })
      .catch(() => {
        Alert.alert('Error', 'Could not save. Check your connection and try again.');
      });
  };

  const handleAddVehicle = () => {
    void addVehicle({ label: 'New Vehicle', makeModel: DEFAULT_MAKE_MODEL, vin: DEFAULT_VIN })
      .then((created) => {
        setEditMakeModel(created.makeModel);
        setEditVin(created.vin);
        setIsEditingVehicle(true);
      })
      .catch(() => {
        Alert.alert('Error', 'Could not add vehicle. Try again.');
      });
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
        return (
          <OwnerDashboard
            vehicleName={currentVehicle?.makeModel || currentVehicle?.label || 'No vehicle'}
          />
        );
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

            <View style={styles.vehicleSwitcherRow}>
              <View style={styles.vehicleChipsContainer}>
                {vehicles.map((vehicle, index) => {
                  const isActive = vehicle._id === selectedVehicleId;
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
                          if (!isEditingVehicle) {
                            setSelectedVehicleId(vehicle._id);
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
                style={styles.vehicleAddButton}
                onPress={handleAddVehicle}
                activeOpacity={0.7}
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
                />
              ) : (
                <Text style={styles.infoValue}>
                  {currentVehicle?.vin || 'Not set'}
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
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Units & Preferences</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Privacy</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Activities' as never)} activeOpacity={0.7}>
          <Text style={styles.menuText}>My Activities</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        {userRole === 'owner' && selectedVehicleId && (
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={() => navigation.navigate('VehicleRecords' as never, { vehicleId: selectedVehicleId } as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.menuText}>Vehicle Records</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        )}
        {userRole === 'admin' && (
          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => navigation.navigate('Admin' as never)} activeOpacity={0.7}>
            <Text style={styles.menuText}>Admin Dashboard</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        )}
        </Card>

        <Card style={styles.section} padded>
        <Text style={styles.sectionTitle}>Switch Profiles</Text>
        <TouchableOpacity
          style={[styles.menuItem, showProfiles && styles.menuItemLast]}
          onPress={handleManageProfiles}
          activeOpacity={0.7}
        >
          <View>
            <Text style={styles.menuText}>Manage Profiles</Text>
            <Text style={styles.currentProfileText}>
              {userRole === 'mechanic'
                ? 'Current: Mechanic'
                : userRole === 'tow'
                ? 'Current: Tow Truck Driver'
                : 'Current: Vehicle Owner'}
            </Text>
          </View>
          <Text style={styles.menuArrow}>{showProfiles ? '▼' : '›'}</Text>
        </TouchableOpacity>
        {showProfiles && (
          <>
            <TouchableOpacity
              style={[
                styles.profileItem,
                userRole === 'owner' && styles.profileItemActive,
              ]}
              onPress={() => handleSelectProfile('owner')}
              activeOpacity={0.7}
            >
              <View style={styles.profileIcon}>
                <Icon name="person" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Vehicle Owner</Text>
                <Text style={styles.profileRole}>Primary driver profile</Text>
                {userRole === 'owner' && (
                  <View style={styles.activeProfilePill}>
                    <Text style={styles.activeProfilePillText}>
                      Active owner profile
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.profileItem,
                userRole === 'mechanic' && styles.profileItemActive,
              ]}
              onPress={() => handleSelectProfile('mechanic')}
              activeOpacity={0.7}
            >
              <View style={styles.profileIcon}>
                <Icon name="construct" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Mechanic</Text>
                <Text style={styles.profileRole}>Vehicle repair specialist</Text>
                {userRole === 'mechanic' && (
                  <View style={styles.activeProfilePill}>
                    <Text style={styles.activeProfilePillText}>
                      Active mechanic profile
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.profileItem,
                styles.profileItemLast,
                userRole === 'tow' && styles.profileItemActive,
              ]}
              onPress={() => handleSelectProfile('tow')}
              activeOpacity={0.7}
            >
              <View style={styles.profileIcon}>
                <Icon name="car" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Tow Truck Driver</Text>
                <Text style={styles.profileRole}>Vehicle towing specialist</Text>
                {userRole === 'tow' && (
                  <View style={styles.activeProfilePill}>
                    <Text style={styles.activeProfilePillText}>
                      Active tow profile
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </>
        )}
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
