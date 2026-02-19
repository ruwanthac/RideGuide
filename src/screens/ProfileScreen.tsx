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

interface ProfileScreenProps {
  onLogout: () => void;
}

const DEFAULT_MAKE_MODEL = 'Toyota Camry 2020';
const DEFAULT_VIN = '1HGBH41JXMN109186';

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout }) => {
  const { spacing, fontSizes, borderRadius, buttonHeight, iconSizes, scale } = useResponsive();
  const [makeModel, setMakeModel] = useState(DEFAULT_MAKE_MODEL);
  const [vin, setVin] = useState(DEFAULT_VIN);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [savedMakeModel, setSavedMakeModel] = useState(DEFAULT_MAKE_MODEL);
  const [savedVin, setSavedVin] = useState(DEFAULT_VIN);
  const [showProfiles, setShowProfiles] = useState(false);

  const startEditingVehicle = () => setIsEditingVehicle(true);

  const handleManageProfiles = () => {
    setShowProfiles(!showProfiles);
  };

  const handleSelectProfile = (profileName: string) => {
    Alert.alert('Profile Selected', `Switched to ${profileName} profile`);
    setShowProfiles(false);
  };

  const cancelEditingVehicle = () => {
    setMakeModel(savedMakeModel);
    setVin(savedVin);
    setIsEditingVehicle(false);
  };

  const handleSaveVehicle = () => {
    if (!makeModel.trim()) {
      Alert.alert('Invalid input', 'Make & Model is required.');
      return;
    }
    setSavedMakeModel(makeModel);
    setSavedVin(vin);
    setIsEditingVehicle(false);
    Alert.alert('Saved', 'Vehicle information has been updated.');
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          padding: spacing.lg,
          paddingTop: spacing.xl + spacing.md,
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
      }),
    [spacing, fontSizes, borderRadius, buttonHeight, iconSizes, scale]
  );

  return (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Manage your account & vehicle</Text>
    </View>

    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Card style={styles.section} padded>
        <Text style={styles.sectionTitle}>Vehicle Info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Make & Model</Text>
          {isEditingVehicle ? (
            <TextInput
              style={styles.vehicleInput}
              value={makeModel}
              onChangeText={setMakeModel}
              placeholder="e.g. Toyota Camry 2020"
              placeholderTextColor={colors.textSecondary}
            />
          ) : (
            <Text style={styles.infoValue}>{makeModel}</Text>
          )}
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>VIN</Text>
          {isEditingVehicle ? (
            <TextInput
              style={styles.vehicleInput}
              value={vin}
              onChangeText={setVin}
              placeholder="e.g. 1HGBH41JXMN109186"
              placeholderTextColor={colors.textSecondary}
            />
          ) : (
            <Text style={styles.infoValue}>{vin}</Text>
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
              <Text style={[styles.editButtonText, { color: colors.textSecondary }]}>Cancel</Text>
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
        <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]}>
          <Text style={styles.menuText}>Privacy</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </Card>

      <Card style={styles.section} padded>
        <Text style={styles.sectionTitle}>Switch Profiles</Text>
        <TouchableOpacity
          style={[styles.menuItem, showProfiles && styles.menuItemLast]}
          onPress={handleManageProfiles}
          activeOpacity={0.7}
        >
          <Text style={styles.menuText}>Manage Profiles</Text>
          <Text style={styles.menuArrow}>{showProfiles ? '▼' : '›'}</Text>
        </TouchableOpacity>
        {showProfiles && (
          <>
            <TouchableOpacity
              style={styles.profileItem}
              onPress={() => handleSelectProfile('Mechanic')}
              activeOpacity={0.7}
            >
              <View style={styles.profileIcon}>
                <Icon name="construct" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Mechanic</Text>
                <Text style={styles.profileRole}>Vehicle repair specialist</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileItem, styles.profileItemLast]}
              onPress={() => handleSelectProfile('Tow Truck Driver')}
              activeOpacity={0.7}
            >
              <View style={styles.profileIcon}>
                <Icon name="car" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Tow Truck Driver</Text>
                <Text style={styles.profileRole}>Vehicle towing specialist</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </Card>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={onLogout}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  </View>
  );
};
