import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { fetchVehicleRecords, VehicleRecords } from '../backend/vehicleRecordsService';

interface Props {
  vehicleId: string;
  onBack: () => void;
}

export const VehicleRecordsScreen: React.FC<Props> = ({ vehicleId, onBack }) => {
  const [data, setData] = useState<VehicleRecords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchVehicleRecords(vehicleId);
        if (alive) setData(r);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load records');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [vehicleId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>{'‹ Back'}</Text></TouchableOpacity>
        <Text style={styles.title}>Vehicle Records</Text>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 32 }} /> :
       error ? <Text style={styles.error}>{error}</Text> :
       !data ? <Text style={styles.error}>No data</Text> : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <Text style={styles.vehicleLabel}>{data.vehicle.label}</Text>
            <Text style={styles.vehicleMeta}>{data.vehicle.makeModel} · VIN {data.vehicle.vin}</Text>
          </View>

          <Text style={styles.section}>Diagnoses ({data.diagnoses.length})</Text>
          {data.diagnoses.length === 0 ? (
            <Text style={styles.empty}>No diagnoses yet.</Text>
          ) : data.diagnoses.map((d) => (
            <View key={d._id} style={styles.row}>
              <Text style={styles.rowTitle}>{d.obdCode || 'Symptom-based'}</Text>
              <Text style={styles.rowMeta}>Severity: {d.severity} · {new Date(d.createdAt).toLocaleString()}</Text>
              <Text style={styles.rowBody} numberOfLines={3}>{d.diagnosis}</Text>
            </View>
          ))}

          <Text style={styles.section}>Service Requests ({data.requests.length})</Text>
          {data.requests.length === 0 ? (
            <Text style={styles.empty}>No service requests yet.</Text>
          ) : data.requests.map((r) => (
            <View key={r._id} style={styles.row}>
              <Text style={styles.rowTitle}>{r.type === 'tow' ? 'Tow' : 'Roadside'} · {r.status}</Text>
              <Text style={styles.rowMeta}>{new Date(r.createdAt).toLocaleString()}</Text>
              <Text style={styles.rowBody} numberOfLines={2}>{r.issue}</Text>
              <Text style={styles.rowMeta}>{r.location}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { color: '#2563EB', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { padding: 16 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 16 },
  vehicleLabel: { fontSize: 18, fontWeight: '700' },
  vehicleMeta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  row: { backgroundColor: '#FFF', padding: 12, borderRadius: 10, marginBottom: 8 },
  rowTitle: { fontWeight: '600' },
  rowMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  rowBody: { marginTop: 4, color: '#111' },
  empty: { color: '#6B7280', fontStyle: 'italic', marginBottom: 12 },
  error: { color: '#B91C1C', padding: 16 },
});

export default VehicleRecordsScreen;
