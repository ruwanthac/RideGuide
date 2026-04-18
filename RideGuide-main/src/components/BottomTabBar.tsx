import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { colors, spacing } from '../constants/theme';
import type { IconName } from './Icon';

export type TabId = 'home' | 'history' | 'profile';

interface TabItem {
  id: TabId;
  label: string;
  icon: IconName;
}

interface BottomTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: TabItem[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'history', label: 'History', icon: 'document-text' },
  { id: 'profile', label: 'Profile', icon: 'person' },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
}) => (
  <View style={styles.container}>
    {TABS.map((tab) => (
      <TouchableOpacity
        key={tab.id}
        style={[styles.tab, activeTab === tab.id && styles.tabActive]}
        onPress={() => onTabChange(tab.id)}
        activeOpacity={0.7}
      >
        <Icon
          name={tab.icon}
          size={22}
          color={activeTab === tab.id ? colors.primary : colors.textSecondary}
          style={StyleSheet.flatten([styles.icon, activeTab === tab.id && styles.iconActive])}
        />
        <Text
          style={StyleSheet.flatten([
            styles.label,
            activeTab === tab.id && styles.labelActive,
          ])}
        >
          {tab.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  tabActive: {
    opacity: 1,
  },
  icon: {
    marginBottom: spacing.xs,
  },
  iconActive: {},
  label: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
