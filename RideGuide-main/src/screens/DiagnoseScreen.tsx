import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Header, InputField, PrimaryButton, Card } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useVehicles } from '../context/VehiclesContext';
import { runDiagnosis } from '../backend/diagnosisService';
import type { DiagnosisEntry } from '../backend/types';

interface DiagnoseScreenProps {
  onBack: () => void;
}

export const DiagnoseScreen: React.FC<DiagnoseScreenProps> = ({ onBack }) => {
  const { selectedVehicle } = useVehicles();
  const [symptoms, setSymptoms] = useState('');
  const [obdCode, setObdCode] = useState('');
  const [result, setResult] = useState<DiagnosisEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const { spacing, fontSizes, verticalScale } = useResponsive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { flex: 1 },
        content: {
          padding: spacing.lg,
          paddingBottom: spacing.xl * 2,
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
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.md,
        },
        resultText: {
          fontSize: fontSizes.md,
          color: colors.textSecondary,
          lineHeight: fontSizes.md * 1.4,
        },
        severityBadge: {
          alignSelf: 'flex-start',
          borderRadius: 4,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs / 2,
          marginBottom: spacing.md,
        },
        severityText: {
          fontSize: fontSizes.xs,
          fontWeight: '700',
          textTransform: 'uppercase',
        },
        sectionTitle: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          marginTop: spacing.md,
          marginBottom: spacing.xs,
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
          lineHeight: fontSizes.sm * 1.4,
        },
      }),
    [spacing, fontSizes, verticalScale]
  );

  const severityColor = (severity: DiagnosisEntry['severity']) => {
    if (severity === 'critical') return '#FF3B30';
    if (severity === 'moderate') return '#FF9500';
    return '#34C759';
  };

  const handleSubmit = async () => {
    if (!selectedVehicle) {
      Alert.alert('No Vehicle Selected', 'Please select a vehicle before running a diagnosis.');
      return;
    }
    setLoading(true);
    try {
      const entry = await runDiagnosis({
        symptoms: symptoms.trim(),
        obdCode: obdCode.trim(),
        vehicleId: selectedVehicle._id,
      });
      setResult(entry);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Diagnosis failed. Please try again.';
      Alert.alert('Diagnosis Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Diagnose Issue"
        showBack
        onBackPress={onBack}
        style={{ paddingTop: spacing.xl + spacing.md }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <InputField
          label="Describe your symptoms"
          placeholder="e.g., Engine makes knocking sound when accelerating"
          value={symptoms}
          onChangeText={setSymptoms}
          multiline
          numberOfLines={4}
          style={styles.textArea}
        />
        <InputField
          label="OBD Code (if available)"
          placeholder="e.g., P0420"
          value={obdCode}
          onChangeText={setObdCode}
        />

        <PrimaryButton
          title="Get Diagnosis"
          onPress={handleSubmit}
          loading={loading}
          style={styles.button}
        />

        {result ? (
          <Card style={styles.resultCard} padded>
            <Text style={styles.resultTitle}>Diagnosis Result</Text>

            <View
              style={[
                styles.severityBadge,
                { backgroundColor: severityColor(result.severity) + '22' },
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
