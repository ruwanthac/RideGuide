import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Animated,
  Easing,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Card, PrimaryButton } from '../';
import { colors } from '../../constants/theme';
import { useResponsive } from '../../hooks';
import { Icon } from '../Icon';

interface MechanicDashboardProps {
  shopName?: string;
}

type WorkshopVerificationStatus =
  | 'not_started'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'needs_more_info';

type WorkshopDocField = 'brCopy' | 'nicCopy';

const DUMMY_REQUESTS = 5;
const DUMMY_MONTHLY_JOBS = 32;
const DUMMY_REVENUE = 'LKR 184,000';

export const MechanicDashboard: React.FC<MechanicDashboardProps> = ({
  shopName,
}) => {
  const { spacing, fontSizes, borderRadius, scale, iconSizes } = useResponsive();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isOnline, setIsOnline] = useState(true);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [workshopNameDraft, setWorkshopNameDraft] = useState(shopName || '');
  const [workshopAddressDraft, setWorkshopAddressDraft] = useState('');
  const [brCopyDraft, setBrCopyDraft] = useState<string | null>(null);
  const [nicCopyDraft, setNicCopyDraft] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] =
    useState<WorkshopVerificationStatus>('not_started');
  const [submittedWorkshop, setSubmittedWorkshop] = useState<{
    name: string;
    address: string;
    brCopy: string;
    nicCopy: string;
  } | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginBottom: spacing.lg,
        },
        sectionTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
          marginBottom: spacing.md,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        statusLabelGroup: {
          flexDirection: 'column',
          flex: 1,
          marginRight: spacing.md,
        },
        statusLabel: {
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.text,
        },
        statusSubLabel: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 2,
        },
        statusPill: {
          marginTop: spacing.sm,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
        },
        statusPillText: {
          fontSize: fontSizes.xs,
          color: colors.success,
          fontWeight: '500',
        },
        metricRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        metricCard: {
          flex: 1,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.lg,
          backgroundColor: 'rgba(15,23,42,0.02)',
        },
        metricSpacer: {
          width: spacing.sm,
        },
        metricLabel: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
        },
        metricValue: {
          fontSize: fontSizes.xxl,
          fontWeight: '700',
          color: colors.text,
          marginTop: 2,
        },
        metricCaption: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: 4,
        },
        revenueRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        revenueLabel: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
        },
        revenueValue: {
          fontSize: fontSizes.xxl,
          fontWeight: '700',
          color: colors.text,
        },
        revenueTag: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(37,99,235,0.06)',
        },
        revenueTagText: {
          fontSize: fontSizes.xs,
          color: colors.primary,
          fontWeight: '500',
        },
        subtleDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginVertical: spacing.md,
        },
        hintText: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: spacing.sm,
        },
        switchTrackColor: {
          false: 'rgba(156,163,175,0.32)',
          true: 'rgba(34,197,94,0.32)',
        } as { false: string; true: string },
        switchThumbColor: {
          false: '#FFFFFF',
          true: colors.success,
        } as { false: string; true: string },
        verificationHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        },
        verificationTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
        },
        verificationBadge: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(245,158,11,0.16)',
        },
        verificationBadgeText: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
          color: '#B45309',
        },
        verificationHelperText: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginBottom: spacing.md,
        },
        verificationInfoText: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        },
        modalSheet: {
          width: '100%',
          backgroundColor: colors.card,
          borderRadius: borderRadius.xl,
          padding: spacing.lg,
        },
        modalTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '700',
          color: colors.text,
          marginBottom: spacing.xs,
        },
        modalSubtitle: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          marginBottom: spacing.md,
        },
        modalFieldLabel: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          fontWeight: '600',
          marginBottom: spacing.xs,
          textTransform: 'uppercase',
        },
        modalInput: {
          backgroundColor: colors.background,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          fontSize: fontSizes.md,
          fontWeight: '500',
          color: colors.text,
          marginBottom: spacing.md,
        },
        docUploadCard: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.background,
          padding: spacing.sm,
          marginBottom: spacing.md,
        },
        docUploadLabel: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
          color: colors.textSecondary,
          textTransform: 'uppercase',
          marginBottom: spacing.xs,
        },
        docPreviewImage: {
          width: '100%',
          height: scale(120),
          borderRadius: borderRadius.md,
          backgroundColor: colors.card,
        },
        docPreviewText: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
        docUploadActions: {
          flexDirection: 'row',
          marginTop: spacing.sm,
          alignItems: 'stretch',
        },
        docUploadActionBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: scale(44),
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.primary,
          backgroundColor: 'rgba(37,99,235,0.06)',
        },
        docUploadActionBtnSpacer: {
          width: spacing.sm,
        },
        docUploadActionIcon: {
          marginRight: spacing.xs,
        },
        docUploadActionText: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: colors.primary,
          textAlign: 'center',
        },
        modalActions: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: spacing.md,
        },
        modalCancelBtn: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
        modalCancelText: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center',
        },
      }),
    [borderRadius, fontSizes, scale, spacing, iconSizes]
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow gallery access to upload documents.');
      return false;
    }
    return true;
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to capture documents.');
      return false;
    }
    return true;
  };

  const setDocValue = (field: WorkshopDocField, uri: string) => {
    if (field === 'brCopy') {
      setBrCopyDraft(uri);
      return;
    }
    setNicCopyDraft(uri);
  };

  const pickDocFromGallery = async (field: WorkshopDocField) => {
    if (!(await requestGalleryPermission())) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setDocValue(field, result.assets[0].uri);
      }
    } catch {
      Alert.alert('Upload failed', 'Unable to pick image from gallery.');
    }
  };

  const captureDocWithCamera = async (field: WorkshopDocField) => {
    if (!(await requestCameraPermission())) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setDocValue(field, result.assets[0].uri);
      }
    } catch {
      Alert.alert('Capture failed', 'Unable to capture image from camera.');
    }
  };

  const renderDocUploadField = (
    label: string,
    field: WorkshopDocField,
    value: string | null
  ) => (
    <View style={styles.docUploadCard}>
      <Text style={styles.docUploadLabel}>{label}</Text>
      {value ? (
        <>
          <Image source={{ uri: value }} style={styles.docPreviewImage} />
          <Text numberOfLines={1} style={styles.docPreviewText}>
            Uploaded: {value}
          </Text>
        </>
      ) : (
        <Text style={styles.docPreviewText}>No document image uploaded yet.</Text>
      )}
      <View style={styles.docUploadActions}>
        <TouchableOpacity
          style={styles.docUploadActionBtn}
          onPress={() => pickDocFromGallery(field)}
          activeOpacity={0.8}
        >
          <Icon
            name="image"
            size={iconSizes.sm}
            color={colors.primary}
            style={styles.docUploadActionIcon}
          />
          <Text numberOfLines={1} style={styles.docUploadActionText}>
            Gallery
          </Text>
        </TouchableOpacity>
        <View style={styles.docUploadActionBtnSpacer} />
        <TouchableOpacity
          style={styles.docUploadActionBtn}
          onPress={() => captureDocWithCamera(field)}
          activeOpacity={0.8}
        >
          <Icon
            name="camera"
            size={iconSizes.sm}
            color={colors.primary}
            style={styles.docUploadActionIcon}
          />
          <Text numberOfLines={1} style={styles.docUploadActionText}>
            Take Photo
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const submitWorkshopVerification = () => {
    const cleanedName = workshopNameDraft.trim();
    const cleanedAddress = workshopAddressDraft.trim();
    const cleanedBr = (brCopyDraft ?? '').trim();
    const cleanedNic = (nicCopyDraft ?? '').trim();
    if (!cleanedName || !cleanedAddress || !cleanedBr || !cleanedNic) return;
    setSubmittedWorkshop({
      name: cleanedName,
      address: cleanedAddress,
      brCopy: cleanedBr,
      nicCopy: cleanedNic,
    });
    setVerificationStatus('submitted');
    setIsVerificationModalOpen(false);
  };

  return (
    <Animated.View
      style={{
        marginBottom: spacing.lg,
        opacity: fadeAnim,
        transform: [
          {
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      <Text style={styles.sectionTitle}>Mechanic Dashboard</Text>

      <Card style={{ marginBottom: spacing.md }} padded>
        <View style={styles.row}>
          <View style={styles.statusLabelGroup}>
            <Text style={styles.statusLabel}>
              {shopName || 'Your workshop'}
            </Text>
            <Text style={styles.statusSubLabel}>
              Control your availability for new jobs.
            </Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {isOnline ? 'Online · visible to drivers' : 'Offline · hidden from owners'}
              </Text>
            </View>
          </View>
          <Switch
            value={isOnline}
            trackColor={styles.switchTrackColor}
            thumbColor={isOnline ? styles.switchThumbColor.true : styles.switchThumbColor.false}
            onValueChange={setIsOnline}
          />
        </View>
      </Card>

      <Card style={{ marginBottom: spacing.md }} padded>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Incoming requests</Text>
            <Text style={styles.metricValue}>{DUMMY_REQUESTS}</Text>
            <Text style={styles.metricCaption}>Waiting for your response</Text>
          </View>
          <View style={styles.metricSpacer} />
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Jobs this month</Text>
            <Text style={styles.metricValue}>{DUMMY_MONTHLY_JOBS}</Text>
            <Text style={styles.metricCaption}>Completed jobs</Text>
          </View>
        </View>
      </Card>

      <Card padded>
        <View style={styles.revenueRow}>
          <View>
            <Text style={styles.revenueLabel}>Revenue (this month)</Text>
            <Text style={styles.revenueValue}>{DUMMY_REVENUE}</Text>
          </View>
          <View style={styles.revenueTag}>
            <Text style={styles.revenueTagText}>+18% vs last month</Text>
          </View>
        </View>
        <View style={styles.subtleDivider} />
        <Text style={styles.hintText}>
          Track completed jobs and payouts in one place. Connect your billing
          to automate settlements.
        </Text>
      </Card>

      <Card style={{ marginTop: spacing.md }} padded>
        <View style={styles.verificationHeaderRow}>
          <Text style={styles.verificationTitle}>Workshop Verification</Text>
          <View style={styles.verificationBadge}>
            <Text style={styles.verificationBadgeText}>
              {verificationStatus === 'not_started'
                ? 'Not started'
                : verificationStatus.replace('_', ' ')}
            </Text>
          </View>
        </View>
        {submittedWorkshop ? (
          <>
            <Text style={styles.verificationInfoText}>Workshop: {submittedWorkshop.name}</Text>
            <Text style={styles.verificationInfoText}>Address: {submittedWorkshop.address}</Text>
            <Text style={styles.verificationInfoText}>BR copy: {submittedWorkshop.brCopy}</Text>
            <Text style={styles.verificationInfoText}>NIC copy: {submittedWorkshop.nicCopy}</Text>
          </>
        ) : (
          <Text style={styles.verificationHelperText}>
            Submit BR copy and NIC copy to verify your workshop profile.
          </Text>
        )}
        <PrimaryButton
          title={submittedWorkshop ? 'Resubmit Verification' : 'Start Verification'}
          onPress={() => setIsVerificationModalOpen(true)}
        />
      </Card>

      <Modal
        visible={isVerificationModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsVerificationModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Workshop Verification</Text>
            <Text style={styles.modalSubtitle}>
              Add workshop details and upload required BR and NIC document copies.
            </Text>
            <Text style={styles.modalFieldLabel}>Workshop Name</Text>
            <TextInput
              value={workshopNameDraft}
              onChangeText={setWorkshopNameDraft}
              placeholder="e.g. Alex Auto Garage"
              placeholderTextColor={colors.textSecondary}
              style={styles.modalInput}
              autoCapitalize="words"
            />
            <Text style={styles.modalFieldLabel}>Workshop Address</Text>
            <TextInput
              value={workshopAddressDraft}
              onChangeText={setWorkshopAddressDraft}
              placeholder="e.g. No 12, Main Street, Colombo"
              placeholderTextColor={colors.textSecondary}
              style={styles.modalInput}
              autoCapitalize="sentences"
            />
            {renderDocUploadField('Business Registration (BR) Copy', 'brCopy', brCopyDraft)}
            {renderDocUploadField('NIC Copy', 'nicCopy', nicCopyDraft)}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => setIsVerificationModalOpen(false)}
                activeOpacity={0.8}
              >
                <View style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, marginLeft: spacing.sm }}
                onPress={submitWorkshopVerification}
                activeOpacity={0.8}
              >
                <PrimaryButton
                  title="Submit"
                  onPress={submitWorkshopVerification}
                  disabled={
                    workshopNameDraft.trim().length === 0 ||
                    workshopAddressDraft.trim().length === 0 ||
                    !brCopyDraft ||
                    !nicCopyDraft
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

