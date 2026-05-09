import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, InputField, PrimaryButton, Card } from '../components';
import { colors, shadows } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useVehicles } from '../context/VehiclesContext';
import { runDiagnosis } from '../backend/diagnosisService';
import { extractApiError } from '../backend/apiClient';
import type { DiagnosisEntry } from '../backend/types';

interface DiagnoseScreenProps {
  onBack: () => void;
}

const SEVERITY_MODERATE = '#D97706';

export const DiagnoseScreen: React.FC<DiagnoseScreenProps> = ({ onBack }) => {
  const { selectedVehicle, vehicles, selectedVehicleId } = useVehicles();
  const effectiveVehicle = useMemo(
    () =>
      selectedVehicle ??
      vehicles.find((v) => v._id === selectedVehicleId) ??
      vehicles[0] ??
      null,
    [selectedVehicle, vehicles, selectedVehicleId],
  );
  const [symptoms, setSymptoms] = useState('');
  const [obdCode, setObdCode] = useState('');
  /** Used when the account has no saved vehicle (e.g. mechanic/tow) — backend accepts make/model without vehicleId. */
  const [manualMakeModel, setManualMakeModel] = useState('');
  const [manualVin, setManualVin] = useState('');
  const [result, setResult] = useState<DiagnosisEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const { spacing, fontSizes, verticalScale, borderRadius } = useResponsive();
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        headerShell: {
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          ...shadows.sm,
        },
        scroll: { flex: 1 },
        content: {
          padding: spacing.lg,
        },
        vehiclePanel: {
          backgroundColor: colors.card,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.sm,
        },
        vehiclePanelText: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          lineHeight: Math.round(fontSizes.md * 1.45),
        },
        vehiclePanelMuted: {
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.textSecondary,
          lineHeight: Math.round(fontSizes.md * 1.45),
        },
        textArea: {
          minHeight: verticalScale(100),
          textAlignVertical: 'top',
        },
        button: {
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
        },
        resultCard: { marginTop: spacing.md },
        resultTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '700',
          color: colors.text,
          marginBottom: spacing.md,
          letterSpacing: 0.2,
        },
        resultText: {
          fontSize: fontSizes.md,
          color: colors.textSecondary,
          lineHeight: Math.round(fontSizes.md * 1.45),
        },
        severityBadge: {
          alignSelf: 'flex-start',
          borderRadius: borderRadius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          marginBottom: spacing.md,
          borderWidth: 1,
        },
        severityText: {
          fontSize: fontSizes.xs,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        sectionTitle: {
          fontSize: fontSizes.md,
          fontWeight: '700',
          color: colors.text,
          marginTop: spacing.lg,
          marginBottom: spacing.sm,
          letterSpacing: 0.15,
        },
        bulletRow: {
          flexDirection: 'row',
          marginBottom: spacing.xs / 2,
        },
        bullet: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginRight: spacing.xs,
        },
        bulletText: {
          flex: 1,
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          lineHeight: Math.round(fontSizes.sm * 1.45),
        },
        inlineError: {
          fontSize: fontSizes.sm,
          color: colors.error,
          marginBottom: spacing.md,
          lineHeight: fontSizes.sm * 1.35,
        },
      }),
    [spacing, fontSizes, verticalScale, borderRadius]
  );

  useEffect(() => {
    setInlineError(null);
  }, [symptoms, obdCode, manualMakeModel, manualVin]);

  const hasVehicleContext = !!effectiveVehicle || manualMakeModel.trim().length > 0;
  const hasSymptomOrCode = !!(symptoms.trim() || obdCode.trim());

  const severityColor = (severity: DiagnosisEntry['severity']) => {
    if (severity === 'critical') return colors.error;
    if (severity === 'moderate') return SEVERITY_MODERATE;
    return colors.success;
  };

  const alertMaybe = (title: string, message: string) => {
    if (Platform.OS !== 'web') Alert.alert(title, message);
  };

  const handleSubmit = async () => {
    setInlineError(null);
    const symptomsTrim = symptoms.trim();
    const obdTrim = obdCode.trim().toUpperCase();
    if (!symptomsTrim && !obdTrim) {
      const msg = 'Enter your symptoms and/or an OBD code, then tap Get Diagnosis.';
      setInlineError(msg);
      alertMaybe('Input needed', msg);
      return;
    }
    if (!effectiveVehicle && !manualMakeModel.trim()) {
      const msg =
        'Enter the vehicle make and model (e.g. 2019 Honda Civic), or add a vehicle in Profile and try again.';
      setInlineError(msg);
      alertMaybe('Vehicle needed', msg);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const entry = effectiveVehicle
        ? await runDiagnosis({
            symptoms: symptomsTrim,
            obdCode: obdTrim,
            vehicleId: effectiveVehicle._id,
          })
        : await runDiagnosis({
            symptoms: symptomsTrim,
            obdCode: obdTrim,
            vehicleMakeModel: manualMakeModel.trim(),
            vehicleVin: manualVin.trim() || undefined,
          });
      setResult(entry);
      setInlineError(null);
    } catch (e) {
      const msg = extractApiError(e, 'Please try again.');
      setInlineError(msg);
      alertMaybe('Diagnosis failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const scrollBottomPad = spacing.xl * 2 + Math.max(insets.bottom, spacing.md);

  return (
    <View style={styles.container}>
      <View style={styles.headerShell}>
        <Header
          title="Diagnose Issue"
          showBack
          onBackPress={onBack}
          style={{ paddingTop: insets.top + spacing.sm }}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.vehiclePanel}>
          {effectiveVehicle ? (
            <Text style={styles.vehiclePanelText}>
              Vehicle: {effectiveVehicle.makeModel}
              {effectiveVehicle.vin ? ` · VIN ${effectiveVehicle.vin}` : ''}
            </Text>
          ) : (
            <Text style={styles.vehiclePanelMuted}>
              No vehicle saved on this account. Enter the customer vehicle below, or add one in Profile for faster
              reuse.
            </Text>
          )}
        </View>

        {!effectiveVehicle ? (
          <>
            <InputField
              label="Make & model"
              placeholder="e.g. 2019 Audi A4 2.0T"
              value={manualMakeModel}
              onChangeText={setManualMakeModel}
            />
            <InputField
              label="VIN (optional)"
              placeholder="e.g. WAUZZZ8K0DA108140"
              value={manualVin}
              onChangeText={setManualVin}
              autoCapitalize="characters"
            />
          </>
        ) : null}

        <InputField
          label="Describe your symptoms"
          placeholder="e.g., Engine makes knocking sound when accelerating"
          value={symptoms}
          onChangeText={setSymptoms}
          multiline
          numberOfLines={4}
          scrollEnabled={false}
          style={styles.textArea}
        />
        <InputField
          label="OBD code"
          placeholder="e.g., P0420"
          value={obdCode}
          onChangeText={(t) => setObdCode(t.toUpperCase())}
          autoCapitalize="characters"
        />

        {inlineError ? <Text style={styles.inlineError}>{inlineError}</Text> : null}

        <PrimaryButton
          title="Get Diagnosis"
          onPress={handleSubmit}
          loading={loading}
          disabled={!hasVehicleContext || !hasSymptomOrCode}
          style={styles.button}
        />

        {result ? (
          <Card style={styles.resultCard} padded>
            <Text style={styles.resultTitle}>Diagnosis Result</Text>

            <View
              style={[
                styles.severityBadge,
                {
                  backgroundColor: severityColor(result.severity) + '22',
                  borderColor: severityColor(result.severity) + '55',
                },
              ]}
            >
              <Text style={[styles.severityText, { color: severityColor(result.severity) }]}>
                {result.severity}
              </Text>
            </View>

            <Text style={styles.resultText}>{result.diagnosis}</Text>

            {result.likelyCauses.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Likely Causes</Text>
                {result.likelyCauses.map((cause, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bullet}>{'\u2022'}</Text>
                    <Text style={styles.bulletText}>{cause}</Text>
                  </View>
                ))}
              </>
            ) : null}

            {result.steps.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Recommended Steps</Text>
                {result.steps.map((step, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bullet}>{i + 1}.</Text>
                    <Text style={styles.bulletText}>{step}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
};
