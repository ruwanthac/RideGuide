import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Header, InputField, PrimaryButton, Card } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useVehicles } from '../context/VehiclesContext';
import { addDiagnosisHistoryEntry } from '../backend';

interface DiagnoseScreenProps {
  onBack: () => void;
}

export const DiagnoseScreen: React.FC<DiagnoseScreenProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { vehicles, selectedVehicleId } = useVehicles();
  const [symptoms, setSymptoms] = useState('');
  const [obdCode, setObdCode] = useState('');
  const [result, setResult] = useState<string | null>(null);
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
      }),
    [spacing, fontSizes, verticalScale]
  );

  const handleSubmit = () => {
    setLoading(true);
    const diagnosisText =
      'Based on your symptoms and OBD code, we recommend checking the oxygen sensor. Common causes include a faulty sensor or exhaust leak. Schedule a diagnostic at a nearby mechanic.';
    setTimeout(() => {
      setResult(diagnosisText);
      setLoading(false);
      const v = vehicles.find((x) => x.id === selectedVehicleId) ?? vehicles[0];
      if (user?.uid && v) {
        void addDiagnosisHistoryEntry(user.uid, {
          vehicleId: v.id,
          vehicleLabel: (v.makeModel || v.label || 'Vehicle').trim(),
          symptoms,
          obdCode,
          diagnosis: diagnosisText,
        });
      }
    }, 1500);
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
            <Text style={styles.resultText}>{result}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
};
