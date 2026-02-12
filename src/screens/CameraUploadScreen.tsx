import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Header, PrimaryButton, Card, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';

interface CameraUploadScreenProps {
  onBack: () => void;
}

export const CameraUploadScreen: React.FC<CameraUploadScreenProps> = ({ onBack }) => {
  const [uploaded, setUploaded] = useState(false);
  const { spacing, fontSizes, iconSizes, borderRadius, verticalScale } = useResponsive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { flex: 1, padding: spacing.lg },
        uploadArea: {
          backgroundColor: colors.card,
          borderRadius: borderRadius.lg,
          padding: spacing.xl * 2,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
          minHeight: verticalScale(200),
          borderWidth: 2,
          borderColor: colors.border,
          borderStyle: 'dashed',
        },
        uploadIcon: { marginBottom: spacing.md },
        uploadTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
        },
        uploadSubtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
        button: { marginTop: spacing.md },
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
    [spacing, fontSizes, iconSizes, borderRadius, verticalScale]
  );

  const handleUpload = () => {
    setUploaded(true);
  };

  return (
    <View style={styles.container}>
      <Header title="Upload Vehicle Image" showBack onBackPress={onBack} />

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.uploadArea}
          onPress={handleUpload}
          activeOpacity={0.8}
        >
          <Icon name="camera" size={iconSizes.xl} color={colors.primary} style={styles.uploadIcon} />
          <Text style={styles.uploadTitle}>
            {uploaded ? 'Image uploaded' : 'Tap to take photo or upload'}
          </Text>
          <Text style={styles.uploadSubtitle}>
            {uploaded
              ? 'Our AI is analyzing your vehicle'
              : 'Camera or gallery access required'}
          </Text>
        </TouchableOpacity>

        {uploaded && (
          <Card style={styles.resultCard} padded>
            <Text style={styles.resultTitle}>Analysis Result</Text>
            <Text style={styles.resultText}>
              Based on the image, we detected possible brake pad wear. We recommend
              scheduling a brake inspection within the next 2 weeks.
            </Text>
          </Card>
        )}

        {!uploaded && (
          <PrimaryButton
            title="Choose from Gallery"
            onPress={handleUpload}
            style={styles.button}
          />
        )}
      </View>
    </View>
  );
};
