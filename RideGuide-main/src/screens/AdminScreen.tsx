import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { fetchAdminStats, listAdminUsers, setAdminUserRole, fetchTowPricing, updateTowPricing } from '../backend';
import type { AuthUser } from '../backend/types';

interface Props { onBack: () => void }

export const AdminScreen: React.FC<Props> = ({ onBack }) => {
  const [stats, setStats] = useState<{ userCount: number; vehicleCount: number; requestCount: number; pendingCount: number } | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [towPerKmDraft, setTowPerKmDraft] = useState('320');
  const [savingPricing, setSavingPricing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, u, pricing] = await Promise.all([fetchAdminStats(), listAdminUsers(), fetchTowPricing()]);
      setStats(s); setUsers(u); setError(null);
      setTowPerKmDraft(String(pricing.towPerKmLkr));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const saveTowPricing = async () => {
    const parsed = Number(towPerKmDraft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Tow per-km rate must be a non-negative number');
      return;
    }
    setSavingPricing(true);
    try {
      const updated = await updateTowPricing(parsed);
      setTowPerKmDraft(String(updated.towPerKmLkr));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update pricing');
    } finally {
      setSavingPricing(false);
    }
  };
  useEffect(() => { load(); }, []);

  const promote = async (u: AuthUser) => {
    const next: AuthUser['role'] = u.role === 'admin' ? 'owner' : 'admin';
    try {
      await setAdminUserRole(u._id, next);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>{'‹ Back'}</Text></TouchableOpacity>
        <Text style={styles.title}>Admin</Text>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 32 }} /> : error ? <Text style={styles.error}>{error}</Text> : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.statsRow}>
            <Stat label="Users" value={stats?.userCount ?? 0} />
            <Stat label="Vehicles" value={stats?.vehicleCount ?? 0} />
            <Stat label="Requests" value={stats?.requestCount ?? 0} />
            <Stat label="Pending" value={stats?.pendingCount ?? 0} />
          </View>
          <Text style={styles.section}>Tow Pricing</Text>
          <View style={styles.pricingCard}>
            <Text style={styles.pricingLabel}>Per km hire amount (LKR)</Text>
            <View style={styles.pricingRow}>
              <TextInput
                value={towPerKmDraft}
                onChangeText={setTowPerKmDraft}
                keyboardType="numeric"
                style={styles.pricingInput}
                placeholder="320"
              />
              <TouchableOpacity style={[styles.btn, savingPricing && { opacity: 0.7 }]} onPress={saveTowPricing} disabled={savingPricing}>
                <Text style={styles.btnText}>{savingPricing ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.section}>Users</Text>
          {users.map((u) => (
            <View key={u._id} style={styles.userRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{u.displayName}</Text>
                <Text style={styles.userMeta}>{u.email} · {u.role}</Text>
              </View>
              <TouchableOpacity style={styles.btn} onPress={() => promote(u)}>
                <Text style={styles.btnText}>{u.role === 'admin' ? 'Demote' : 'Make Admin'}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { color: '#2563EB', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { padding: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  stat: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, flex: 1, marginHorizontal: 4, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  section: { fontSize: 16, fontWeight: '700', marginVertical: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 10, marginBottom: 8 },
  userName: { fontWeight: '600' },
  userMeta: { fontSize: 12, color: '#6B7280' },
  pricingCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 8 },
  pricingLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  pricingRow: { flexDirection: 'row', alignItems: 'center' },
  pricingInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#FFF',
  },
  btn: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: '#FFF', fontWeight: '600' },
  error: { color: '#B91C1C', padding: 16 },
});

export default AdminScreen;
