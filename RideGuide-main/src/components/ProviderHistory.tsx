import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { colors } from '../constants/theme';
import { useCompletedJobs, completedAt, isSameMonth } from '../hooks';
import type { ServiceRequest } from '../backend/types';
import { formatCurrencyAmount } from '../utils/formatMoneyAmount';

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fareOf(j: ServiceRequest): number | null {
  const v = j.finalAmount ?? j.estimatedAmount;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function avgAcceptLabel(jobs: ServiceRequest[]): string {
  const waits = jobs
    .filter((j) => j.acceptedAt)
    .map((j) => (new Date(j.acceptedAt as string).getTime() - new Date(j.createdAt).getTime()) / 60000)
    .filter((m) => Number.isFinite(m) && m >= 0);
  if (!waits.length) return '–';
  const avg = waits.reduce((a, b) => a + b, 0) / waits.length;
  if (avg < 1) return '<1 min';
  if (avg < 60) return `${Math.round(avg)} min`;
  const h = Math.floor(avg / 60);
  const m = Math.round(avg % 60);
  return m ? `${h} h ${m} m` : `${h} h`;
}

function whenLabel(d: Date, now = new Date()): string {
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

/** Mechanic / tow History: a month summary card, then the jobs finished that month. */
export const ProviderHistory: React.FC<{ role: 'mechanic' | 'tow' }> = ({ role }) => {
  const isTow = role === 'tow';
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const { jobs, error, reload } = useCompletedJobs(isTow ? 'tow' : 'roadside', refreshKey);

  const today = new Date();
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const isThisMonth = month.y === today.getFullYear() && month.m === today.getMonth();
  const [openId, setOpenId] = useState<string | null>(null);

  const shiftMonth = (delta: number) => {
    setOpenId(null);
    setMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const monthJobs = useMemo(
    () => (jobs ?? []).filter((j) => isSameMonth(completedAt(j), month.y, month.m)),
    [jobs, month]
  );

  const stats = useMemo(() => {
    const third = isTow
      ? {
          value: Math.round(monthJobs.reduce((sum, j) => sum + (fareOf(j) ?? 0), 0)).toLocaleString(),
          label: `${monthJobs[0]?.currency ?? 'LKR'} earned`,
        }
      : { value: String(new Set(monthJobs.map((j) => j.requesterId)).size), label: 'drivers helped' };
    return [
      { value: String(monthJobs.length), label: 'jobs done' },
      { value: avgAcceptLabel(monthJobs), label: 'avg. to accept' },
      third,
    ];
  }, [monthJobs, isTow]);

  // Four bars: days 1–7, 8–14, 15–21, 22–end.
  const weeks = useMemo(() => {
    const counts = [0, 0, 0, 0];
    for (const j of monthJobs) counts[Math.min(3, Math.floor((completedAt(j).getDate() - 1) / 7))] += 1;
    const current = isThisMonth ? Math.min(3, Math.floor((today.getDate() - 1) / 7)) : -1;
    const max = Math.max(1, ...counts);
    return counts.map((n, i) => ({ n, height: 8 + (n / max) * 50, label: i === current ? 'This wk' : `Wk ${i + 1}`, current: i === current }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthJobs, isThisMonth]);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshKey((k) => k + 1);
    setRefreshing(false);
  };

  const monthName = `${MONTHS[month.m]}${month.y !== today.getFullYear() ? ` ${month.y}` : ''}`;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <Text style={styles.title} accessibilityRole="header">
        Your work
      </Text>

      <View style={styles.summary}>
        <View style={styles.monthRow}>
          <Pressable
            style={({ pressed }) => [styles.monthBtn, pressed && styles.pressed]}
            onPress={() => shiftMonth(-1)}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Icon name="chevron-back" size={18} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.monthLabel} accessibilityLiveRegion="polite">
            {monthName.toUpperCase()}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.monthBtn, isThisMonth && { opacity: 0.3 }, pressed && styles.pressed]}
            onPress={() => shiftMonth(1)}
            disabled={isThisMonth}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: isThisMonth }}
          >
            <Icon name="chevron-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.value} ${s.label}`}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {s.value}
              </Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.bars} accessible accessibilityLabel={`Jobs per week: ${weeks.map((w) => `${w.label} ${w.n}`).join(', ')}`}>
          {weeks.map((w) => (
            <View key={w.label} style={styles.barCol}>
              <View style={[styles.bar, { height: w.height, backgroundColor: w.current ? '#60A5FA' : 'rgba(255,255,255,0.22)' }]} />
              <Text style={styles.barLabel}>{w.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Finished jobs</Text>
        <Pressable onPress={() => navigation.navigate('ObdDiagnoseHistory')} accessibilityRole="link" hitSlop={10}>
          <Text style={styles.link}>My diagnoses</Text>
        </Pressable>
      </View>

      {jobs === null ? (
        error ? (
          <Text style={styles.empty}>We couldn’t load your jobs. Pull down to try again.</Text>
        ) : (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
        )
      ) : monthJobs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No finished jobs in {MONTHS[month.m]}</Text>
          <Text style={styles.empty}>
            {isThisMonth ? 'Jobs you mark as done show up here.' : 'Try another month with the arrows above.'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {monthJobs.map((j) => {
            const open = openId === j._id;
            const fare = fareOf(j);
            const place = isTow ? j.pickupAddress?.trim() || j.location : j.location;
            return (
              <Pressable
                key={j._id}
                style={({ pressed }) => [styles.card, pressed && { backgroundColor: '#F8FAFC' }]}
                onPress={() => setOpenId(open ? null : j._id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${j.issue || 'Job'} for ${j.userName}, ${whenLabel(completedAt(j))}`}
                accessibilityHint={open ? 'Hides the details' : 'Shows the details'}
              >
                <View style={styles.cardTop}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>
                      {j.issue || (isTow ? 'Tow' : 'Roadside help')}
                    </Text>
                  </View>
                  <Text style={styles.when}>{whenLabel(completedAt(j))}</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {j.userName}
                    </Text>
                    <Text style={styles.meta} numberOfLines={open ? undefined : 1}>
                      {j.vehicle}
                      {place ? ` · ${place}` : ''}
                    </Text>
                  </View>
                  {isTow && fare != null ? <Text style={styles.fare}>{formatCurrencyAmount(j.currency, fare)}</Text> : null}
                  <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" />
                </View>
                {open ? (
                  <View style={styles.details}>
                    {isTow ? (
                      <>
                        <Detail label="Picked up from" value={j.pickupAddress?.trim() || j.location} />
                        <Detail label="Dropped off at" value={j.dropoffAddress?.trim() || 'Not given'} />
                      </>
                    ) : (
                      <Detail label="Where" value={j.location} />
                    )}
                    {j.acceptedAt ? (
                      <Detail
                        label="Time"
                        value={`Accepted ${new Date(j.acceptedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · finished ${completedAt(j).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                      />
                    ) : null}
                    {j.phoneNumber ? <Detail label="Phone" value={j.phoneNumber} /> : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Text style={styles.detail}>
    <Text style={styles.detailLabel}>{label}: </Text>
    {value}
  </Text>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
  title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  summary: { backgroundColor: INK, borderRadius: 22, padding: 16, gap: 14 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 13, fontWeight: '700', color: '#CBD5E1', letterSpacing: 0.5 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 12, color: '#CBD5E1', marginTop: 2 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 78 },
  barCol: { flex: 1, alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 11, color: '#CBD5E1' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: INK },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 18, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  chip: { flexShrink: 1, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FFEDD5' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#9A3412' },
  when: { fontSize: 12, color: MUTED, flexShrink: 0 },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 15, fontWeight: '700', color: INK },
  meta: { fontSize: 13, color: MUTED, marginTop: 2 },
  fare: { fontSize: 14, fontWeight: '700', color: '#166534' },
  details: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, gap: 4 },
  detail: { fontSize: 13, color: '#334155', lineHeight: 19 },
  detailLabel: { fontWeight: '700', color: INK },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', padding: 20, alignItems: 'center', gap: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: INK },
  empty: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 19 },
  pressed: { opacity: 0.8 },
});
