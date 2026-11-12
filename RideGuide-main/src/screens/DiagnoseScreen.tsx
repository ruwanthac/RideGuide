import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, DiagnosisResult, diagnosisAsText } from '../components';
import { colors } from '../constants/theme';
import { useVehicles } from '../context/VehiclesContext';
import { runDiagnosis } from '../backend/diagnosisService';
import { extractApiError } from '../backend/apiClient';
import type { DiagnosisEntry } from '../backend/types';

interface DiagnoseScreenProps {
  onBack: () => void;
}

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';

const SIGNS = ['Strange noise', 'Warning light', 'Shaking', "Won't start", 'Smoke', 'Leak', 'Burning smell'];
const WHEN = ['Cold start', 'At idle', 'Accelerating', 'Braking', 'Turning', 'All the time'];

/** Combines the free text with the tapped chips into the description the AI receives. */
export function buildSymptoms(text: string, signs: string[], when: string[]): string {
  const parts = [text.trim().replace(/[.\s]+$/, '')];
  if (signs.length) parts.push(`Signs: ${signs.map((s) => s.toLowerCase()).join(', ')}`);
  if (when.length) parts.push(`Happens: ${when.map((s) => s.toLowerCase()).join(', ')}`);
  const joined = parts.filter(Boolean).join('. ');
  return joined ? `${joined}.` : '';
}

export const DiagnoseScreen: React.FC<DiagnoseScreenProps> = ({ onBack }) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { selectedVehicle, vehicles, selectedVehicleId, setSelectedVehicleId } = useVehicles();
  const vehicle = useMemo(
    () => selectedVehicle ?? vehicles.find((v) => v._id === selectedVehicleId) ?? vehicles[0] ?? null,
    [selectedVehicle, vehicles, selectedVehicleId]
  );

  const [text, setText] = useState('');
  const [signs, setSigns] = useState<string[]>([]);
  const [when, setWhen] = useState<string[]>([]);
  const [obdCode, setObdCode] = useState('');
  /** Accounts without a saved vehicle (e.g. mechanics) type it in; the backend accepts make/model without an id. */
  const [manualMakeModel, setManualMakeModel] = useState('');
  const [result, setResult] = useState<DiagnosisEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symptoms = buildSymptoms(text, signs, when);
  const canSubmit = (!!vehicle || manualMakeModel.trim().length > 0) && (symptoms.length > 0 || obdCode.trim().length > 0);

  const toggle = (list: string[], set: (v: string[]) => void, item: string) => {
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
    setError(null);
  };

  const changeVehicle = () => {
    if (vehicles.length < 2) return;
    Alert.alert('Which vehicle?', undefined, [
      ...vehicles.map((v) => ({
        text: `${v.makeModel}${v.plate ? ` · ${v.plate}` : ''}`,
        onPress: () => void setSelectedVehicleId(v._id),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const submit = async () => {
    if (!canSubmit || loading) return;
    setError(null);
    setLoading(true);
    try {
      const entry = vehicle
        ? await runDiagnosis({ symptoms, obdCode: obdCode.trim().toUpperCase(), vehicleId: vehicle._id })
        : await runDiagnosis({ symptoms, obdCode: obdCode.trim().toUpperCase(), vehicleMakeModel: manualMakeModel.trim() });
      setResult(entry);
    } catch (e) {
      setError(extractApiError(e, "We couldn't get a diagnosis. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: '#F4F6FA' },
        header: { paddingTop: insets.top + 8, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
        backBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: LINE,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: { fontSize: 20, fontWeight: '800', color: INK },
        content: { padding: 20, paddingTop: 18, gap: 18 },
        vehicleCard: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: LINE,
          borderRadius: 16,
          padding: 10,
          paddingLeft: 12,
        },
        vehicleIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
        vehicleName: { fontSize: 15, fontWeight: '700', color: INK },
        vehicleMeta: { fontSize: 12, color: MUTED },
        change: { fontSize: 14, fontWeight: '600', color: colors.primary, padding: 10 },
        sectionLabel: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 8 },
        textArea: {
          minHeight: 96,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: colors.primary,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 12,
          fontSize: 15,
          lineHeight: 21,
          color: INK,
          textAlignVertical: 'top',
        },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
        chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, justifyContent: 'center' },
        chipText: { fontSize: 13 },
        obdCard: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: LINE,
          borderRadius: 16,
          padding: 12,
          paddingLeft: 14,
        },
        obdTitle: { fontSize: 14, fontWeight: '700', color: INK },
        obdHint: { fontSize: 12, color: MUTED, marginTop: 2 },
        obdInput: {
          width: 120,
          height: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#CBD5E1',
          textAlign: 'center',
          fontSize: 16,
          fontWeight: '700',
          letterSpacing: 1,
          color: INK,
          fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
        },
        manualInput: {
          height: 52,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: '#CBD5E1',
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 16,
          fontSize: 16,
          color: INK,
        },
        error: { color: colors.error, fontSize: 14, fontWeight: '600', lineHeight: 20 },
        footer: {
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom, 12) + 8,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: LINE,
        },
        submit: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
        submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
        footerHint: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 8 },
        pressed: { opacity: 0.85 },
      }),
    [insets]
  );

  if (result) {
    const homeOrParent = (screen: string, params?: object) => {
      // From the Home stack these screens are siblings; navigating by name works directly.
      navigation.navigate(screen, params);
    };
    return (
      <DiagnosisResult
        entry={result}
        onBack={() => setResult(null)}
        onGetMechanic={() => homeOrParent('TowTruckAssistant', { tripType: 'roadside' })}
        onAskExpert={() =>
          homeOrParent('VideoCall', {
            priorConversationSummary: diagnosisAsText(result),
            vehicleId: result.vehicleId ?? undefined,
          })
        }
      />
    );
  }

  const renderChips = (items: string[], selected: string[], set: (v: string[]) => void) => (
    <View style={styles.chips}>
      {items.map((item) => {
        const on = selected.includes(item);
        return (
          <Pressable
            key={item}
            onPress={() => toggle(selected, set, item)}
            style={[
              styles.chip,
              { borderColor: on ? colors.primary : '#CBD5E1', backgroundColor: on ? '#EFF6FF' : '#FFFFFF' },
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <Text style={[styles.chipText, { color: on ? '#1E3A8A' : '#334155', fontWeight: on ? '600' : '500' }]}>{item}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevron-back" size={20} color={INK} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Diagnose an issue
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {vehicle ? (
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleIcon}>
              <Icon name="car" size={18} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vehicleName} numberOfLines={1}>
                {vehicle.makeModel}
              </Text>
              <Text style={styles.vehicleMeta} numberOfLines={1}>
                {[vehicle.year, vehicle.plate].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {vehicles.length > 1 ? (
              <Pressable onPress={changeVehicle} accessibilityRole="button" accessibilityLabel="Change vehicle">
                <Text style={styles.change}>Change</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View>
            <Text style={styles.sectionLabel} nativeID="d-vehicle">
              Which vehicle?
            </Text>
            <TextInput
              style={styles.manualInput}
              value={manualMakeModel}
              onChangeText={setManualMakeModel}
              placeholder="Make and model, e.g. 2019 Honda Civic"
              placeholderTextColor="#94A3B8"
              accessibilityLabelledBy="d-vehicle"
              accessibilityLabel="Vehicle make and model"
            />
          </View>
        )}

        <View>
          <Text style={styles.sectionLabel} nativeID="d-what">
            What's happening?
          </Text>
          <TextInput
            style={styles.textArea}
            value={text}
            onChangeText={(t) => {
              setText(t);
              setError(null);
            }}
            placeholder="e.g. Engine shakes at idle and the check engine light is flashing"
            placeholderTextColor="#94A3B8"
            multiline
            accessibilityLabelledBy="d-what"
            accessibilityLabel="What's happening"
          />
          {renderChips(SIGNS, signs, setSigns)}
        </View>

        <View>
          <Text style={styles.sectionLabel}>When does it happen?</Text>
          {renderChips(WHEN, when, setWhen)}
        </View>

        <View style={styles.obdCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.obdTitle} nativeID="d-obd">
              OBD code <Text style={{ fontWeight: '500', color: MUTED }}>(optional)</Text>
            </Text>
            <Text style={styles.obdHint}>From a scanner, e.g. P0420</Text>
          </View>
          <TextInput
            style={styles.obdInput}
            value={obdCode}
            onChangeText={(t) => {
              setObdCode(t.toUpperCase());
              setError(null);
            }}
            placeholder="P0000"
            placeholderTextColor="#CBD5E1"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={30}
            accessibilityLabelledBy="d-obd"
            accessibilityLabel="OBD code, optional"
          />
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: canSubmit ? colors.primary : '#93C5FD' },
            pressed && canSubmit && styles.pressed,
          ]}
          onPress={submit}
          disabled={!canSubmit || loading}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit, busy: loading }}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="sparkles" size={20} color="#FFFFFF" />}
          <Text style={styles.submitText}>{loading ? 'Checking your car…' : 'Get diagnosis'}</Text>
        </Pressable>
        {!canSubmit ? <Text style={styles.footerHint}>Describe the problem, tap a sign, or enter a code.</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
};
