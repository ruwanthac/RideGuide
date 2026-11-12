import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useVehicles } from '../context/VehiclesContext';
import { useProfileNotifications } from '../context/ProfileNotificationsContext';
import { ChangePasswordSheet } from './BottomSheet';
import { friendlyErrorMessage } from '../backend/apiClient';
import type { Vehicle } from '../backend/types';

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
export const MAX_OWNER_VEHICLES = 3;

type VehicleForm = { makeModel: string; year: string; plate: string; vin: string };
const EMPTY_FORM: VehicleForm = { makeModel: '', year: '', plate: '', vin: '' };

function validateVehicle(f: VehicleForm): string | null {
  if (!f.makeModel.trim()) return 'Please enter the make and model, e.g. Toyota Axio.';
  const y = Number(f.year);
  const maxYear = new Date().getFullYear() + 1;
  if (!/^\d{4}$/.test(f.year.trim()) || y < 1950 || y > maxYear) return `Please enter a year between 1950 and ${maxYear}.`;
  if (!f.plate.trim()) return 'Please enter the plate number.';
  if (!f.vin.trim()) return 'Please enter the VIN or chassis number.';
  return null;
}

/** Owner Profile: account card, vehicles, settings and log out. */
export const OwnerProfile: React.FC = () => {
  const { user, signOutUser } = useAuth();
  const { vehicles, selectedVehicle, setSelectedVehicleId, addVehicle, saveVehicle, removeVehicle } = useVehicles();
  const { items: notifications } = useProfileNotifications();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const inUse = selectedVehicle ?? vehicles[0] ?? null;
  const unread = notifications.filter((n) => !n.read).length;
  const name = user?.displayName?.trim() || 'Your account';

  // Vehicle sheet: add (no id) or edit (id)
  const [vehicleSheet, setVehicleSheet] = useState<{ id: string | null } | null>(null);
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setVehicleSheet({ id: null });
  };
  const openEdit = (v: Vehicle) => {
    setForm({ makeModel: v.makeModel ?? '', year: v.year != null ? String(v.year) : '', plate: v.plate ?? '', vin: v.vin ?? '' });
    setFormError(null);
    setVehicleSheet({ id: v._id });
  };

  const saveVehicleSheet = async () => {
    const problem = validateVehicle(form);
    setFormError(problem);
    if (problem || !vehicleSheet) return;
    setSavingVehicle(true);
    const payload = {
      makeModel: form.makeModel.trim(),
      label: form.makeModel.trim(),
      year: Number(form.year),
      plate: form.plate.trim().toUpperCase(),
      vin: form.vin.trim().toUpperCase(),
    };
    try {
      if (vehicleSheet.id) {
        await saveVehicle(vehicleSheet.id, payload);
      } else {
        const created = await addVehicle(payload);
        await setSelectedVehicleId(created._id);
      }
      setVehicleSheet(null);
    } catch (e) {
      setFormError(friendlyErrorMessage(e, "We couldn't save this vehicle. Please try again."));
    } finally {
      setSavingVehicle(false);
    }
  };

  const confirmRemove = () => {
    const id = vehicleSheet?.id;
    if (!id) return;
    Alert.alert('Remove this vehicle?', 'Its past diagnoses stay in your history.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await removeVehicle(id);
              const next = vehicles.find((v) => v._id !== id);
              if (next && inUse?._id === id) await setSelectedVehicleId(next._id);
              setVehicleSheet(null);
            } catch (e) {
              setFormError(friendlyErrorMessage(e, "We couldn't remove this vehicle. Please try again."));
            }
          })();
        },
      },
    ]);
  };

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOutUser() },
    ]);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: '#F4F6FA' },
        content: { paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 28, gap: 16 },
        title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
        card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 20, padding: 14 },
        avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
        avatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
        name: { fontSize: 17, fontWeight: '700', color: INK },
        sub: { fontSize: 13, color: MUTED, marginTop: 2 },
        pillBtn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: '#CBD5E1', justifyContent: 'center' },
        pillText: { fontSize: 13, fontWeight: '700', color: INK },
        sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
        sectionTitle: { fontSize: 16, fontWeight: '700', color: INK },
        count: { fontSize: 13, color: MUTED },
        vehicles: { gap: 10, paddingRight: 20 },
        vCard: { width: 200, borderRadius: 18, padding: 14, gap: 6 },
        vKicker: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
        vName: { fontSize: 17, fontWeight: '800' },
        vMeta: { fontSize: 13 },
        vEdit: { fontSize: 13, fontWeight: '700', marginTop: 4 },
        addCard: {
          width: 110,
          borderRadius: 18,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: '#94A3B8',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
        addText: { fontSize: 13, fontWeight: '700', color: '#334155' },
        list: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 20, overflow: 'hidden' },
        row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
        rowDivider: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
        rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
        rowText: { flex: 1, fontSize: 15, fontWeight: '600', color: INK },
        badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
        badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
        logout: { height: 50, borderRadius: 16, borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
        logoutText: { color: '#B91C1C', fontSize: 15, fontWeight: '700' },
        footer: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: -6 },
        pressed: { opacity: 0.85 },
        // Sheets
        backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.5)', justifyContent: 'flex-end' },
        sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: Math.max(insets.bottom, 16) + 12, gap: 14 },
        sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        sheetTitle: { fontSize: 22, fontWeight: '800', color: INK },
        closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
        label: { fontSize: 14, fontWeight: '600', color: INK, marginBottom: 6 },
        input: { height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#CBD5E1', paddingHorizontal: 14, fontSize: 16, color: INK },
        twoCol: { flexDirection: 'row', gap: 12 },
        error: { color: colors.error, fontSize: 14, fontWeight: '600' },
        primary: { height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
        primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
        remove: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
        removeText: { color: '#B91C1C', fontSize: 15, fontWeight: '700' },
      }),
    [insets]
  );

  const settings: { key: string; label: string; icon: IconName; bg: string; fg: string; onPress: () => void; badge?: number }[] = [
    { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', bg: '#FEE2E2', fg: '#B91C1C', onPress: () => navigation.navigate('ProfileNotifications'), badge: unread },
    { key: 'details', label: 'Name and phone number', icon: 'person', bg: '#DBEAFE', fg: '#1D4ED8', onPress: () => navigation.navigate('Privacy') },
    { key: 'password', label: 'Change password', icon: 'lock-closed', bg: '#DCFCE7', fg: '#15803D', onPress: () => setPasswordOpen(true) },
  ];

  const field = (key: keyof VehicleForm, label: string, props: React.ComponentProps<typeof TextInput> = {}) => (
    <View style={{ flex: 1 }}>
      <Text style={styles.label} nativeID={`v-${key}`}>
        {label}
      </Text>
      <TextInput
        style={styles.input}
        value={form[key]}
        onChangeText={(t) => setForm((f) => ({ ...f, [key]: key === 'year' ? t.replace(/[^0-9]/g, '').slice(0, 4) : t }))}
        placeholderTextColor="#94A3B8"
        accessibilityLabelledBy={`v-${key}`}
        accessibilityLabel={label}
        {...props}
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">
          Profile
        </Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {user?.email ? (
              <Text style={styles.sub} numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
            {user?.phoneNumber ? <Text style={styles.sub}>{user.phoneNumber}</Text> : null}
          </View>
          <Pressable
            style={({ pressed }) => [styles.pillBtn, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Privacy')}
            accessibilityRole="button"
            accessibilityLabel="Edit name and phone number"
          >
            <Text style={styles.pillText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>My vehicles</Text>
          <Text style={styles.count}>
            {vehicles.length} of {MAX_OWNER_VEHICLES}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicles} style={{ marginRight: -20 }}>
          {vehicles.map((v) => {
            const on = v._id === inUse?._id;
            return (
              <Pressable
                key={v._id}
                style={({ pressed }) => [
                  styles.vCard,
                  on ? { backgroundColor: colors.primary } : { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE },
                  pressed && styles.pressed,
                ]}
                onPress={() => (on ? openEdit(v) : void setSelectedVehicleId(v._id))}
                onLongPress={() => openEdit(v)}
                accessibilityRole="button"
                accessibilityLabel={on ? `${v.makeModel}, in use. Edit details` : `${v.makeModel}. Use this vehicle`}
                accessibilityHint={on ? undefined : 'Long press to edit'}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.vKicker, { color: on ? '#DBEAFE' : MUTED }]}>{on ? 'IN USE' : 'TAP TO USE'}</Text>
                  {on ? <Icon name="checkmark" size={18} color="#FFFFFF" /> : null}
                </View>
                <Text style={[styles.vName, { color: on ? '#FFFFFF' : INK }]} numberOfLines={1}>
                  {v.makeModel}
                </Text>
                <Text style={[styles.vMeta, { color: on ? '#DBEAFE' : MUTED }]} numberOfLines={1}>
                  {[v.year, v.plate].filter(Boolean).join(' · ')}
                </Text>
                {on ? <Text style={[styles.vEdit, { color: '#FFFFFF' }]}>Edit details</Text> : null}
              </Pressable>
            );
          })}
          {vehicles.length < MAX_OWNER_VEHICLES ? (
            <Pressable
              style={({ pressed }) => [styles.addCard, pressed && styles.pressed]}
              onPress={openAdd}
              accessibilityRole="button"
              accessibilityLabel="Add a vehicle"
            >
              <Icon name="add" size={22} color="#334155" />
              <Text style={styles.addText}>Add</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={styles.list}>
          {settings.map((s, i) => (
            <Pressable
              key={s.key}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && { backgroundColor: '#F8FAFC' }]}
              onPress={s.onPress}
              accessibilityRole="button"
              accessibilityLabel={s.badge ? `${s.label}, ${s.badge} unread` : s.label}
            >
              <View style={[styles.rowIcon, { backgroundColor: s.bg }]}>
                <Icon name={s.icon} size={18} color={s.fg} />
              </View>
              <Text style={styles.rowText}>{s.label}</Text>
              {s.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{s.badge > 9 ? '9+' : s.badge}</Text>
                </View>
              ) : null}
              <Icon name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          ))}
        </View>

        <Pressable style={({ pressed }) => [styles.logout, pressed && styles.pressed]} onPress={confirmLogout} accessibilityRole="button">
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
        <Text style={styles.footer}>Vehicle owner account · RideGuide {Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>

      <Modal visible={!!vehicleSheet} transparent animationType="slide" onRequestClose={() => setVehicleSheet(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.backdrop} onPress={() => setVehicleSheet(null)} accessibilityLabel="Close">
            <Pressable style={styles.sheet} onPress={() => undefined} accessible={false}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle} accessibilityRole="header">
                  {vehicleSheet?.id ? 'Edit vehicle' : 'Add a vehicle'}
                </Text>
                <Pressable style={styles.closeBtn} onPress={() => setVehicleSheet(null)} accessibilityRole="button" accessibilityLabel="Close">
                  <Icon name="close" size={20} color={INK} />
                </Pressable>
              </View>
              {field('makeModel', 'Make & model', { placeholder: 'e.g. Toyota Axio', autoCapitalize: 'words' })}
              <View style={styles.twoCol}>
                {field('year', 'Year', { placeholder: 'e.g. 2016', keyboardType: 'number-pad' })}
                {field('plate', 'Plate number', { placeholder: 'e.g. CAB-4521', autoCapitalize: 'characters' })}
              </View>
              {field('vin', 'VIN or chassis number', { placeholder: 'e.g. NZE141-1234567', autoCapitalize: 'characters', autoCorrect: false })}
              {formError ? (
                <Text style={styles.error} accessibilityRole="alert">
                  {formError}
                </Text>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.primary, (pressed || savingVehicle) && styles.pressed]}
                onPress={() => void saveVehicleSheet()}
                disabled={savingVehicle}
                accessibilityRole="button"
              >
                {savingVehicle ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{vehicleSheet?.id ? 'Save changes' : 'Add vehicle'}</Text>}
              </Pressable>
              {vehicleSheet?.id && vehicles.length > 1 ? (
                <Pressable style={styles.remove} onPress={confirmRemove} accessibilityRole="button">
                  <Text style={styles.removeText}>Remove this vehicle</Text>
                </Pressable>
              ) : null}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <ChangePasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </View>
  );
};
