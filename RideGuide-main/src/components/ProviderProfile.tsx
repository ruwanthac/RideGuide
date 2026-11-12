import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { BottomSheet, ChangePasswordSheet, SheetField, sheetStyles } from './BottomSheet';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useProfileNotifications } from '../context/ProfileNotificationsContext';
import { useCompletedJobs, completedAt, isSameMonth, useProviderAvailability } from '../hooks';
import { updateUserProfile } from '../backend/userProfileService';
import { friendlyErrorMessage } from '../backend/apiClient';

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';

type DetailsForm = { businessName: string; businessAddress: string; truckName: string; plateNumber: string };

/** Mechanic / tow Profile: business card with stats, the online switch, details and settings. */
export const ProviderProfile: React.FC<{ role: 'mechanic' | 'tow' }> = ({ role }) => {
  const isTow = role === 'tow';
  const { user, signOutUser, refreshProfile } = useAuth();
  const { items: notifications } = useProfileNotifications();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { online, switching, toggle } = useProviderAvailability();
  const { jobs } = useCompletedJobs(isTow ? 'tow' : 'roadside');

  const unread = notifications.filter((n) => !n.read).length;
  const businessName = user?.businessName?.trim() || user?.displayName?.trim() || (isTow ? 'Your tow service' : 'Your workshop');
  const subline = isTow
    ? [user?.truckName?.trim(), user?.plateNumber?.trim()].filter(Boolean).join(' · ')
    : user?.businessAddress?.trim() ?? '';
  const verification = user?.providerVerificationStatus;
  const memberSince = user?.createdAt ? String(new Date(user.createdAt).getFullYear()) : '–';

  const thisMonth = useMemo(() => {
    if (!jobs) return null;
    const t = new Date();
    return jobs.filter((j) => isSameMonth(completedAt(j), t.getFullYear(), t.getMonth())).length;
  }, [jobs]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [form, setForm] = useState<DetailsForm>({ businessName: '', businessAddress: '', truckName: '', plateNumber: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openDetails = () => {
    setForm({
      businessName: user?.businessName ?? '',
      businessAddress: user?.businessAddress ?? '',
      truckName: user?.truckName ?? '',
      plateNumber: user?.plateNumber ?? '',
    });
    setFormError(null);
    setDetailsOpen(true);
  };

  const saveDetails = async () => {
    if (!form.businessName.trim()) return setFormError(isTow ? 'Please enter your company name.' : 'Please enter your workshop name.');
    if (isTow && !form.plateNumber.trim()) return setFormError('Please enter the truck’s plate number.');
    setFormError(null);
    setSaving(true);
    try {
      await updateUserProfile(
        isTow
          ? { businessName: form.businessName.trim(), truckName: form.truckName.trim() || null, plateNumber: form.plateNumber.trim().toUpperCase() }
          : { businessName: form.businessName.trim(), businessAddress: form.businessAddress.trim() || null }
      );
      await refreshProfile();
      setDetailsOpen(false);
    } catch (e) {
      setFormError(friendlyErrorMessage(e, "We couldn't save your details. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You won’t get new jobs on this phone until you sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOutUser() },
    ]);
  };

  const rows: { key: string; label: string; icon: IconName; bg: string; fg: string; value?: string; badge?: number; onPress: () => void }[] = [
    { key: 'details', label: isTow ? 'Truck and company' : 'Workshop details', icon: isTow ? 'car' : 'construct', bg: '#FFEDD5', fg: '#C2410C', onPress: openDetails },
    { key: 'phone', label: 'Contact number', icon: 'call', bg: '#E0E7FF', fg: '#4338CA', value: user?.phoneNumber?.trim() || 'Add one', onPress: () => navigation.navigate('Privacy') },
    { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', bg: '#FEE2E2', fg: '#B91C1C', badge: unread, onPress: () => navigation.navigate('ProfileNotifications') },
    { key: 'password', label: 'Change password', icon: 'lock-closed', bg: '#DCFCE7', fg: '#15803D', onPress: () => setPasswordOpen(true) },
  ];

  const stats = [
    { value: thisMonth == null ? '–' : String(thisMonth), label: 'this month' },
    { value: jobs == null ? '–' : String(jobs.length), label: 'all time' },
    { value: memberSince, label: 'member since' },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">
          Profile
        </Text>

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.kicker}>{isTow ? 'TOW TRUCK' : 'MECHANIC · WORKSHOP'}</Text>
              <Text style={styles.business} numberOfLines={2}>
                {businessName}
              </Text>
              {subline ? (
                <Text style={styles.subline} numberOfLines={2}>
                  {subline}
                </Text>
              ) : null}
            </View>
            {verification === 'approved' ? (
              <View style={styles.verified}>
                <Icon name="checkmark" size={12} color="#166534" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : verification === 'pending' ? (
              <View style={[styles.verified, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.verifiedText, { color: '#92400E' }]}>Under review</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.stats}>
            {stats.map((s) => (
              <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.value} ${s.label}`}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.onlineRow, (pressed || switching) && styles.pressed]}
          onPress={() => void toggle()}
          disabled={switching}
          accessibilityRole="switch"
          accessibilityState={{ checked: online, busy: switching }}
          accessibilityLabel="Online for new jobs"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.onlineTitle}>Online for new jobs</Text>
            <Text style={styles.onlineSub}>
              {switching
                ? 'Updating…'
                : online
                ? isTow
                  ? 'Sharing your location while online'
                  : 'Drivers near you can send you jobs'
                : 'You won’t get new requests'}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: online ? '#16A34A' : '#CBD5E1', alignItems: online ? 'flex-end' : 'flex-start' }]}>
            <View style={styles.knob} />
          </View>
        </Pressable>

        <View style={styles.list}>
          {rows.map((r, i) => (
            <Pressable
              key={r.key}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && { backgroundColor: '#F8FAFC' }]}
              onPress={r.onPress}
              accessibilityRole="button"
              accessibilityLabel={r.badge ? `${r.label}, ${r.badge} unread` : r.value ? `${r.label}, ${r.value}` : r.label}
            >
              <View style={[styles.rowIcon, { backgroundColor: r.bg }]}>
                <Icon name={r.icon} size={18} color={r.fg} />
              </View>
              <Text style={styles.rowText}>{r.label}</Text>
              {r.value ? (
                <Text style={styles.rowValue} numberOfLines={1}>
                  {r.value}
                </Text>
              ) : null}
              {r.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{r.badge > 9 ? '9+' : r.badge}</Text>
                </View>
              ) : null}
              <Icon name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          ))}
        </View>

        <Pressable style={({ pressed }) => [styles.logout, pressed && styles.pressed]} onPress={confirmLogout} accessibilityRole="button">
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
        <Text style={styles.footer}>
          {isTow ? 'Tow truck account' : 'Mechanic account'} · RideGuide {Constants.expoConfig?.version ?? ''}
        </Text>
      </ScrollView>

      <BottomSheet visible={detailsOpen} title={isTow ? 'Truck and company' : 'Workshop details'} onClose={() => setDetailsOpen(false)}>
        <SheetField
          id="d-name"
          label={isTow ? 'Company name' : 'Workshop name'}
          value={form.businessName}
          onChangeText={(t) => setForm((f) => ({ ...f, businessName: t }))}
          autoCapitalize="words"
          placeholder={isTow ? 'e.g. City Tow 24/7' : 'e.g. Sunil Auto Care'}
        />
        {isTow ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <SheetField
                id="d-truck"
                label="Truck"
                value={form.truckName}
                onChangeText={(t) => setForm((f) => ({ ...f, truckName: t }))}
                placeholder="e.g. Isuzu flatbed"
              />
            </View>
            <View style={{ flex: 1 }}>
              <SheetField
                id="d-plate"
                label="Plate number"
                value={form.plateNumber}
                onChangeText={(t) => setForm((f) => ({ ...f, plateNumber: t }))}
                autoCapitalize="characters"
                placeholder="e.g. LK-4421"
              />
            </View>
          </View>
        ) : (
          <SheetField
            id="d-address"
            label="Address"
            value={form.businessAddress}
            onChangeText={(t) => setForm((f) => ({ ...f, businessAddress: t }))}
            placeholder="e.g. Galle Rd, Dehiwala"
          />
        )}
        {formError ? (
          <Text style={sheetStyles.error} accessibilityRole="alert">
            {formError}
          </Text>
        ) : null}
        <Pressable
          style={({ pressed }) => [sheetStyles.primary, (pressed || saving) && sheetStyles.pressed]}
          onPress={() => void saveDetails()}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={sheetStyles.primaryText}>Save changes</Text>}
        </Pressable>
      </BottomSheet>

      <ChangePasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
  title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  card: { backgroundColor: colors.primary, borderRadius: 24, padding: 18, gap: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  kicker: { fontSize: 12, fontWeight: '700', color: '#BFDBFE', letterSpacing: 0.6 },
  business: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  subline: { fontSize: 13, color: '#DBEAFE', marginTop: 2 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  verifiedText: { fontSize: 12, fontWeight: '700', color: '#166534' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 12, color: '#DBEAFE' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 18, padding: 14 },
  onlineTitle: { fontSize: 15, fontWeight: '700', color: INK },
  onlineSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  track: { width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
  list: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600', color: INK },
  rowValue: { fontSize: 13, color: MUTED, maxWidth: 130 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  logout: { height: 50, borderRadius: 16, borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: '#B91C1C', fontSize: 15, fontWeight: '700' },
  footer: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: -6 },
  pressed: { opacity: 0.85 },
});
