import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Card } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { Icon } from '../components';

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  date: string;
}

const ONGOING_ITEMS: ActivityItem[] = [
  { id: '1', title: 'Engine diagnosis', subtitle: 'In progress', date: 'Started 2 hrs ago' },
  { id: '2', title: 'Tow request', subtitle: 'Driver assigned', date: 'ETA 25 min' },
];

const COMPLETED_ITEMS: ActivityItem[] = [
  { id: '1', title: 'Engine Check', subtitle: 'Resolved · P0420', date: 'Feb 8, 2025' },
  { id: '2', title: 'Brake inspection', subtitle: 'Fluid topped up', date: 'Feb 5, 2025' },
  { id: '3', title: 'Battery test', subtitle: 'No action needed', date: 'Feb 1, 2025' },
];

const CANCELLED_ITEMS: ActivityItem[] = [
  { id: '1', title: 'Tow request', subtitle: 'Cancelled by user', date: 'Jan 28, 2025' },
];

type Tab = 'ongoing' | 'completed' | 'cancelled';

interface ActivitiesScreenProps {
  onBack: () => void;
}

export const ActivitiesScreen: React.FC<ActivitiesScreenProps> = ({ onBack }) => {
  const { spacing, fontSizes, borderRadius } = useResponsive();
  const [activeTab, setActiveTab] = useState<Tab>('ongoing');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.lg,
          paddingTop: spacing.xl * 2 + spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        },
        backButton: {
          padding: spacing.sm,
          marginRight: spacing.sm,
        },
        headerTitle: {
          fontSize: fontSizes.xl,
          fontWeight: '700',
          color: colors.text,
        },
        tabRow: {
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        tab: {
          flex: 1,
          paddingVertical: spacing.sm,
          alignItems: 'center',
          borderRadius: borderRadius.md,
          marginHorizontal: spacing.xs,
        },
        tabFirst: { marginLeft: 0 },
        tabLast: { marginRight: 0 },
        tabActive: {
          backgroundColor: 'rgba(37,99,235,0.08)',
        },
        tabText: {
          fontSize: fontSizes.sm,
          fontWeight: '500',
          color: colors.textSecondary,
        },
        tabTextActive: {
          color: colors.primary,
          fontWeight: '600',
        },
        scrollContent: {
          padding: spacing.lg,
          paddingBottom: spacing.xl * 2,
        },
        sectionTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.md,
          marginTop: spacing.md,
        },
        sectionTitleFirst: { marginTop: 0 },
        card: { marginBottom: spacing.md },
        cardRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        },
        cardTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          flex: 1,
        },
        cardSubtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: 2,
        },
        cardDate: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
        },
        emptyText: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          textAlign: 'center',
          paddingVertical: spacing.xl,
        },
      }),
    [spacing, fontSizes, borderRadius]
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ongoing', label: 'Ongoing' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const getData = (): ActivityItem[] => {
    switch (activeTab) {
      case 'ongoing':
        return ONGOING_ITEMS;
      case 'completed':
        return COMPLETED_ITEMS;
      case 'cancelled':
        return CANCELLED_ITEMS;
    }
  };

  const data = getData();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your activities</Text>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              index === 0 && styles.tabFirst,
              index === tabs.length - 1 && styles.tabLast,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.sectionTitle,
            styles.sectionTitleFirst,
          ]}
        >
          {activeTab === 'ongoing' && 'Ongoing'}
          {activeTab === 'completed' && 'Completed'}
          {activeTab === 'cancelled' && 'Cancelled'}
        </Text>
        {data.length === 0 ? (
          <Text style={styles.emptyText}>No activities in this section.</Text>
        ) : (
          data.map((item) => (
            <Card key={item.id} style={styles.card} padded>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                </View>
                <Text style={styles.cardDate}>{item.date}</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
};
