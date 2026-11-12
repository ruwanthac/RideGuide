import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { colors } from '../constants/theme';
import { listDiagnosisHistory } from '../backend/diagnosisHistoryService';
import { listServiceRequests } from '../backend/serviceRequestsService';
import { listAssistantChatSessions } from '../backend/assistantChatHistoryService';
import { listAiCallHistory } from '../backend/aiCallHistoryService';
import { navigateToTowOwnerTracking } from '../navigation/historyCrossTabNavigate';
import type { DiagnosisEntry, ServiceRequest } from '../backend/types';

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';

type Kind = 'diagnosis' | 'roadside' | 'tow' | 'chat' | 'call';
type Filter = 'all' | 'diagnosis' | 'help' | 'ai';

type Item = {
  key: string;
  kind: Kind;
  at: number;
  title: string;
  meta: string;
  badge?: { label: string; bg: string; fg: string };
  onPress?: () => void;
};

const KIND_STYLE: Record<Kind, { bg: string; fg: string; icon: IconName | 'tow-truck' }> = {
  diagnosis: { bg: '#DBEAFE', fg: '#1D4ED8', icon: 'construct' },
  roadside: { bg: '#FFEDD5', fg: '#C2410C', icon: 'help-buoy' },
  tow: { bg: '#DCFCE7', fg: '#15803D', icon: 'tow-truck' },
  chat: { bg: '#EDE9FE', fg: '#6D28D9', icon: 'chatbubble' },
  call: { bg: '#E2E8F0', fg: INK, icon: 'videocam' },
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'diagnosis', label: 'Diagnoses' },
  { id: 'help', label: 'Roadside & tow' },
  { id: 'ai', label: 'AI chats & calls' },
];

const SEVERITY_BADGE: Record<DiagnosisEntry['severity'], Item['badge']> = {
  critical: { label: 'Critical', bg: '#FEE2E2', fg: '#B91C1C' },
  moderate: { label: 'Needs attention', bg: '#FFEDD5', fg: '#C2410C' },
  minor: { label: 'Minor', bg: '#DCFCE7', fg: '#166534' },
};

function requestBadge(status: ServiceRequest['status']): Item['badge'] {
  if (status === 'completed') return { label: 'Completed', bg: '#DCFCE7', fg: '#166534' };
  if (status === 'cancelled') return { label: 'Cancelled', bg: '#F1F5F9', fg: '#475569' };
  return { label: 'In progress', bg: '#DBEAFE', fg: '#1D4ED8' };
}

function dayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const firstPart = (address?: string | null) => (address ?? '').split(',')[0]?.trim();

function matchesFilter(kind: Kind, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'diagnosis') return kind === 'diagnosis';
  if (filter === 'help') return kind === 'roadside' || kind === 'tow';
  return kind === 'chat' || kind === 'call';
}

/** Owner History: diagnoses, roadside and tow requests, AI chats and video calls in one dated list. */
export const OwnerHistory: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    // Each source is loaded on its own so one failing doesn't empty the whole history.
    const [diagnoses, requests, chats, calls] = await Promise.allSettled([
      listDiagnosisHistory(),
      listServiceRequests({ history: true }),
      listAssistantChatSessions(),
      listAiCallHistory(),
    ]);
    const next: Item[] = [];
    if (diagnoses.status === 'fulfilled') {
      for (const d of diagnoses.value) {
        const at = Date.parse(d.createdAt);
        const cause = d.likelyCauses[0] ?? d.symptoms;
        next.push({
          key: `d-${d._id}`,
          kind: 'diagnosis',
          at,
          title: `${cause || 'Diagnosis'}${d.obdCode ? ` · ${d.obdCode}` : ''}`,
          meta: `${d.vehicleLabel} · ${timeOf(at)}`,
          badge: SEVERITY_BADGE[d.severity],
          onPress: () => navigation.navigate('DiagnosisHistoryDetail', { entry: d }),
        });
      }
    }
    if (requests.status === 'fulfilled') {
      for (const r of requests.value) {
        const at = Date.parse(r.createdAt);
        const active = r.status !== 'completed' && r.status !== 'cancelled';
        const provider = r.acceptedProviderDisplayName?.trim();
        next.push({
          key: `r-${r._id}`,
          kind: r.type === 'tow' ? 'tow' : 'roadside',
          at,
          title:
            r.type === 'tow'
              ? `Tow${firstPart(r.dropoffAddress) ? ` to ${firstPart(r.dropoffAddress)}` : ''}`
              : r.issue?.startsWith('Roadside help:')
                ? r.issue
                : 'Roadside help',
          meta: [provider, r.vehicle, timeOf(at)].filter(Boolean).join(' · '),
          badge: requestBadge(r.status),
          onPress: active ? () => navigateToTowOwnerTracking(navigation, r._id) : undefined,
        });
      }
    }
    if (chats.status === 'fulfilled') {
      for (const c of chats.value) {
        const at = Date.parse(c.updatedAt || c.createdAt);
        next.push({
          key: `c-${c._id}`,
          kind: 'chat',
          at,
          title: c.previewTitle || 'AI Assistant chat',
          meta: `AI Assistant · ${timeOf(at)}`,
          onPress: () => navigation.navigate('AssistantHistoryDetail', { id: c._id }),
        });
      }
    }
    if (calls.status === 'fulfilled') {
      for (const c of calls.value) {
        const at = Date.parse(c.createdAt);
        const minutes = c.endedAt ? Math.max(1, Math.round((Date.parse(c.endedAt) - at) / 60000)) : null;
        next.push({
          key: `v-${c._id}`,
          kind: 'call',
          at,
          // Calls whose summary couldn't be written have a placeholder summary; show a plain title instead.
          title:
            !c.summary || /summary (unavailable|not available)/i.test(c.summary)
              ? 'Video call with the Vehicle Expert'
              : c.summary.split(/[.\n]/)[0].slice(0, 90),
          meta: `Video call${minutes ? ` · ${minutes} min` : ''} · ${timeOf(at)}`,
          onPress: () => navigation.navigate('AiVideoHistoryDetail', { id: c._id }),
        });
      }
    }
    next.sort((a, b) => b.at - a.at);
    setItems(next);
    const allFailed = [diagnoses, requests, chats, calls].every((r) => r.status === 'rejected');
    setStatus(allFailed ? 'error' : 'ready');
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = items.filter(
      (it) => matchesFilter(it.kind, filter) && (!q || `${it.title} ${it.meta}`.toLowerCase().includes(q))
    );
    const out: { title: string; data: Item[] }[] = [];
    for (const it of shown) {
      const label = dayLabel(it.at);
      const last = out[out.length - 1];
      if (last && last.title === label) last.data.push(it);
      else out.push({ title: label, data: [it] });
    }
    return out;
  }, [items, filter, query]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: '#F4F6FA' },
        header: { paddingTop: insets.top + 16, paddingHorizontal: 20, gap: 14 },
        titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
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
        search: {
          height: 46,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: '#CBD5E1',
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 14,
          fontSize: 15,
          color: INK,
        },
        chips: { gap: 8, paddingRight: 20 },
        chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, justifyContent: 'center' },
        chipText: { fontSize: 13 },
        list: { paddingHorizontal: 20, paddingBottom: 24 },
        dayLabel: { fontSize: 13, fontWeight: '700', color: MUTED, marginTop: 18, marginBottom: 8 },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: '#FFFFFF',
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: LINE,
        },
        rowFirst: { borderTopWidth: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
        rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
        rowDivider: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
        icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
        rowTitle: { fontSize: 15, fontWeight: '600', color: INK },
        rowMeta: { fontSize: 12, color: MUTED, marginTop: 2 },
        badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
        badgeText: { fontSize: 11, fontWeight: '700' },
        empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30, gap: 8 },
        emptyTitle: { fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center' },
        emptyText: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },
        pressed: { opacity: 0.85 },
      }),
    [insets.top]
  );

  const renderItem = ({ item, index, section }: { item: Item; index: number; section: { data: Item[] } }) => {
    const k = KIND_STYLE[item.kind];
    const first = index === 0;
    const last = index === section.data.length - 1;
    return (
      <Pressable
        onPress={item.onPress}
        disabled={!item.onPress}
        style={({ pressed }) => [styles.row, first && styles.rowFirst, last && styles.rowLast, !first && styles.rowDivider, pressed && styles.pressed]}
        accessibilityRole={item.onPress ? 'button' : undefined}
        accessibilityLabel={`${item.title}. ${item.meta}${item.badge ? `. ${item.badge.label}` : ''}`}
      >
        <View style={[styles.icon, { backgroundColor: k.bg }]}>
          {k.icon === 'tow-truck' ? (
            <MaterialCommunityIcons name="tow-truck" size={22} color={k.fg} />
          ) : (
            <Icon name={k.icon} size={19} color={k.fg} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {item.meta}
          </Text>
        </View>
        {item.badge ? (
          <View style={[styles.badge, { backgroundColor: item.badge.bg }]}>
            <Text style={[styles.badgeText, { color: item.badge.fg }]}>{item.badge.label}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const emptyMessage =
    status === 'error'
      ? { title: "We couldn't load your history", text: 'Check your connection and pull down to try again.' }
      : query.trim()
        ? { title: 'No matches', text: 'Try a different word, or clear the search.' }
        : filter === 'all'
          ? { title: 'Nothing here yet', text: 'Your diagnoses, roadside help, tows, AI chats and video calls will show up here.' }
          : { title: 'Nothing in this filter yet', text: 'Try "All" to see everything.' };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            History
          </Text>
          <Pressable
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            onPress={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setQuery('');
            }}
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? 'Close search' : 'Search history'}
          >
            <Icon name={searchOpen ? 'close' : 'search'} size={20} color={INK} />
          </Pressable>
        </View>
        {searchOpen ? (
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search, e.g. battery or P0301"
            placeholderTextColor="#94A3B8"
            autoFocus
            returnKeyType="search"
            accessibilityLabel="Search history"
          />
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[styles.chip, { borderColor: on ? INK : '#CBD5E1', backgroundColor: on ? INK : '#FFFFFF' }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, { color: on ? '#FFFFFF' : '#334155', fontWeight: on ? '700' : '500' }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {status === 'loading' ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.primary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(it) => it.key}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => <Text style={styles.dayLabel}>{section.title}</Text>}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{emptyMessage.title}</Text>
              <Text style={styles.emptyText}>{emptyMessage.text}</Text>
            </View>
          }
        />
      )}
    </View>
  );
};
