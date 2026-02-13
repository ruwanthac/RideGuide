import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Card } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';

interface ProfileScreenProps {
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout }) => {
  const { spacing, fontSizes, borderRadius, buttonHeight } = useResponsive();

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
      }),
    [spacing, fontSizes, borderRadius, buttonHeight]
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
          <Text style={styles.infoValue}>Toyota Camry 2020</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>VIN</Text>
          <Text style={styles.infoValue}>1HGBH41JXMN109186</Text>
        </View>
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit Vehicle</Text>
        </TouchableOpacity>
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
