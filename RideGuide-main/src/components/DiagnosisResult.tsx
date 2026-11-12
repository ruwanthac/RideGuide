import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { colors } from '../constants/theme';
import type { DiagnosisEntry } from '../backend/types';

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const STEPS_PREVIEW = 3;

/** Banner wording and colours by severity: what it means for the owner right now */
export const SEVERITY_BANNER: Record<
  DiagnosisEntry['severity'],
  { kicker: string; title: string; bg: string; kickerColor: string; bodyColor: string; icon: IconName }
> = {
  critical: { kicker: 'CRITICAL', title: 'Get it checked today', bg: '#B91C1C', kickerColor: '#FECACA', bodyColor: '#FEE2E2', icon: 'warning' },
  moderate: { kicker: 'NEEDS ATTENTION', title: 'Get it checked soon', bg: '#C2410C', kickerColor: '#FED7AA', bodyColor: '#FFEDD5', icon: 'warning' },
  minor: { kicker: 'MINOR', title: 'Safe to drive. Keep an eye on it.', bg: '#15803D', kickerColor: '#BBF7D0', bodyColor: '#DCFCE7', icon: 'checkmark-circle' },
};

/** Older diagnoses have no summary: use the first two sentences of the full explanation. */
export function diagnosisSummary(entry: DiagnosisEntry): string {
  if (entry.summary?.trim()) return entry.summary.trim();
  const sentences = entry.diagnosis.match(/[^.!?]+[.!?]+/g) ?? [entry.diagnosis];
  return sentences.slice(0, 2).join(' ').trim();
}

/** Plain-text version for sharing and for giving the Vehicle Expert context. */
export function diagnosisAsText(entry: DiagnosisEntry): string {
  const lines = [
    `RideGuide diagnosis: ${entry.vehicleLabel}${entry.obdCode ? ` (${entry.obdCode})` : ''}`,
    `Severity: ${SEVERITY_BANNER[entry.severity].kicker.toLowerCase()}`,
    diagnosisSummary(entry),
    entry.symptoms ? `Symptoms: ${entry.symptoms}` : '',
    entry.likelyCauses.length ? `Likely causes: ${entry.likelyCauses.join('; ')}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

type Props = {
  entry: DiagnosisEntry;
  onBack: () => void;
  onGetMechanic: () => void;
  onAskExpert: () => void;
};

/** Diagnosis result: how serious it is first, then likely causes, what to do now and the full explanation. */
export const DiagnosisResult: React.FC<Props> = ({ entry, onBack, onGetMechanic, onAskExpert }) => {
  const insets = useSafeAreaInsets();
  const banner = SEVERITY_BANNER[entry.severity];
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const subtitle = [
    entry.vehicleLabel,
    entry.obdCode || null,
    new Date(entry.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
  ]
    .filter(Boolean)
    .join(' · ');
  const steps = showAllSteps ? entry.steps : entry.steps.slice(0, STEPS_PREVIEW);

  const share = () => {
    void Share.share({ message: diagnosisAsText(entry) }).catch(() => undefined);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: '#F4F6FA' },
        header: { paddingTop: insets.top + 8, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
        roundBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: LINE,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: { fontSize: 18, fontWeight: '800', color: INK },
        subtitle: { fontSize: 12, color: MUTED, marginTop: 1 },
        content: { padding: 20, paddingTop: 16, gap: 14 },
        banner: { backgroundColor: banner.bg, borderRadius: 22, padding: 16, flexDirection: 'row', gap: 12 },
        bannerIcon: {
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.18)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: banner.kickerColor },
        bannerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
        bannerBody: { fontSize: 14, lineHeight: 20, color: banner.bodyColor, marginTop: 4 },
        card: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: LINE, padding: 16, gap: 12 },
        cardTitle: { fontSize: 16, fontWeight: '700', color: INK },
        causeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
        rankText: { fontSize: 13, fontWeight: '700' },
        causeText: { flex: 1, fontSize: 15, color: INK, lineHeight: 21 },
        stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
        box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
        stepText: { flex: 1, fontSize: 14, lineHeight: 20, color: INK },
        stepDone: { color: MUTED, textDecorationLine: 'line-through' },
        link: { fontSize: 14, fontWeight: '600', color: colors.primary, paddingVertical: 4 },
        detailsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        body: { fontSize: 14, lineHeight: 21, color: '#334155' },
        label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: MUTED },
        footer: {
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom, 12) + 8,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: LINE,
          gap: 10,
        },
        primary: { height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
        primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
        secondary: {
          height: 48,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: '#CBD5E1',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        },
        secondaryText: { color: INK, fontSize: 15, fontWeight: '700' },
        disclaimer: { fontSize: 11, color: MUTED, textAlign: 'center' },
        pressed: { opacity: 0.85 },
      }),
    [insets, banner]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevron-back" size={20} color={INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header">
            Diagnosis
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Pressable style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]} onPress={share} accessibilityRole="button" accessibilityLabel="Share diagnosis">
          <Icon name="share-outline" size={18} color={INK} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.banner} accessible accessibilityLabel={`${banner.kicker}. ${banner.title}. ${diagnosisSummary(entry)}`}>
          <View style={styles.bannerIcon}>
            <Icon name={banner.icon} size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{banner.kicker}</Text>
            <Text style={styles.bannerTitle}>{banner.title}</Text>
            <Text style={styles.bannerBody}>{diagnosisSummary(entry)}</Text>
          </View>
        </View>

        {entry.likelyCauses.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Most likely causes</Text>
            {entry.likelyCauses.map((cause, i) => (
              <View key={i} style={styles.causeRow}>
                <View style={[styles.rank, { backgroundColor: i === 0 ? INK : LINE }]}>
                  <Text style={[styles.rankText, { color: i === 0 ? '#FFFFFF' : INK }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.causeText, i === 0 && { fontWeight: '600' }]}>{cause}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {entry.steps.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>What to do now</Text>
            {steps.map((step, i) => {
              const done = !!checked[i];
              return (
                <Pressable
                  key={i}
                  style={styles.stepRow}
                  onPress={() => setChecked((c) => ({ ...c, [i]: !done }))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={step}
                >
                  <View style={[styles.box, { borderColor: done ? colors.primary : '#CBD5E1', backgroundColor: done ? colors.primary : '#FFFFFF' }]}>
                    {done ? <Icon name="checkmark" size={14} color="#FFFFFF" /> : null}
                  </View>
                  <Text style={[styles.stepText, done && styles.stepDone]}>{step}</Text>
                </Pressable>
              );
            })}
            {entry.steps.length > STEPS_PREVIEW ? (
              <Pressable onPress={() => setShowAllSteps((v) => !v)} accessibilityRole="button">
                <Text style={styles.link}>{showAllSteps ? 'Show fewer steps' : `Show all ${entry.steps.length} steps`}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Pressable
            style={styles.detailsHead}
            onPress={() => setShowDetails((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDetails }}
          >
            <Text style={styles.cardTitle}>Full explanation</Text>
            <Icon name={showDetails ? 'chevron-up' : 'chevron-down'} size={18} color={MUTED} />
          </Pressable>
          {showDetails ? (
            <>
              <Text style={styles.body}>{entry.diagnosis}</Text>
              {entry.symptoms ? (
                <View style={{ gap: 4 }}>
                  <Text style={styles.label}>WHAT YOU REPORTED</Text>
                  <Text style={styles.body}>{entry.symptoms}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={onGetMechanic} accessibilityRole="button">
          <Text style={styles.primaryText}>Get a mechanic to come to me</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={onAskExpert} accessibilityRole="button">
          <Icon name="videocam" size={18} color={INK} />
          <Text style={styles.secondaryText}>Ask the Vehicle Expert</Text>
        </Pressable>
        <Text style={styles.disclaimer}>AI guidance, not a replacement for a mechanic's inspection.</Text>
      </View>
    </View>
  );
};
