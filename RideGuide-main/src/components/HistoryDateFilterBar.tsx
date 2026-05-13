import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { normalizeDateRange, startOfDay } from '../utils/historyDateRange';

export interface HistoryDateFilterBarProps {
  from: Date | null;
  to: Date | null;
  onChange: (next: { from: Date | null; to: Date | null }) => void;
}

function formatDay(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function openWebDatePrompt(which: 'from' | 'to', from: Date | null, to: Date | null, onChange: HistoryDateFilterBarProps['onChange']) {
  if (typeof window === 'undefined' || !window.prompt) return;
  const label = which === 'from' ? 'From' : 'To';
  const raw = window.prompt(`${label} date (YYYY-MM-DD)`, '');
  if (raw == null || !raw.trim()) return;
  const parsed = new Date(`${raw.trim()}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return;
  const day = startOfDay(parsed);
  onChange(which === 'from' ? normalizeDateRange(day, to) : normalizeDateRange(from, day));
}

export const HistoryDateFilterBar: React.FC<HistoryDateFilterBarProps> = ({ from, to, onChange }) => {
  const { spacing, fontSizes } = useResponsive();
  const [iosOpen, setIosOpen] = useState(false);
  const [iosWhich, setIosWhich] = useState<'from' | 'to' | null>(null);
  const [iosDraft, setIosDraft] = useState(() => startOfDay(new Date()));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
        label: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
          color: colors.textSecondary,
          marginBottom: spacing.xs,
        },
        row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
        dateBtn: {
          flex: 1,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: 10,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        },
        dateBtnText: { fontSize: fontSizes.sm, color: colors.text },
        dateHint: { fontSize: fontSizes.xs, color: colors.textSecondary, marginBottom: 2 },
        clearWrap: { marginTop: spacing.sm, alignSelf: 'flex-start' },
        clearText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },
        modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
        modalSheet: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingBottom: spacing.xl,
        },
        modalHdr: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        hdrBtn: { padding: spacing.sm },
        hdrBtnText: { fontSize: fontSizes.md, color: colors.primary },
        hdrDone: { fontWeight: '700' },
      }),
    [spacing, fontSizes]
  );

  const hasFilter = from != null || to != null;

  const commitIos = useCallback(() => {
    if (!iosWhich) return;
    const snap = startOfDay(iosDraft);
    const next =
      iosWhich === 'from' ? normalizeDateRange(snap, to) : normalizeDateRange(from, snap);
    onChange(next);
    setIosOpen(false);
    setIosWhich(null);
  }, [iosWhich, iosDraft, from, to, onChange]);

  const openPicker = (which: 'from' | 'to') => {
    const current = which === 'from' ? from : to;
    const seed =
      current && !Number.isNaN(current.getTime()) ? startOfDay(current) : startOfDay(new Date());

    if (Platform.OS === 'web') {
      openWebDatePrompt(which, from, to, onChange);
      return;
    }

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: seed,
        mode: 'date',
        onChange: (ev, selected) => {
          if (ev.type !== 'set' || !selected) return;
          const day = startOfDay(selected);
          const next =
            which === 'from' ? normalizeDateRange(day, to) : normalizeDateRange(from, day);
          onChange(next);
        },
      });
      return;
    }

    setIosDraft(seed);
    setIosWhich(which);
    setIosOpen(true);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Filter by date</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('from')} accessibilityRole="button">
          <Text style={styles.dateHint}>From</Text>
          <Text style={styles.dateBtnText}>{from ? formatDay(from) : 'Any'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('to')} accessibilityRole="button">
          <Text style={styles.dateHint}>To</Text>
          <Text style={styles.dateBtnText}>{to ? formatDay(to) : 'Any'}</Text>
        </TouchableOpacity>
      </View>
      {hasFilter ? (
        <TouchableOpacity
          style={styles.clearWrap}
          onPress={() => onChange({ from: null, to: null })}
          accessibilityRole="button"
        >
          <Text style={styles.clearText}>Clear date filter</Text>
        </TouchableOpacity>
      ) : null}
      {Platform.OS === 'ios' ? (
        <Modal
          transparent
          animationType="fade"
          visible={iosOpen}
          onRequestClose={() => {
            setIosOpen(false);
            setIosWhich(null);
          }}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setIosOpen(false);
              setIosWhich(null);
            }}
          >
            <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHdr}>
                <TouchableOpacity
                  style={styles.hdrBtn}
                  onPress={() => {
                    setIosOpen(false);
                    setIosWhich(null);
                  }}
                >
                  <Text style={styles.hdrBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.hdrBtn} onPress={commitIos}>
                  <Text style={[styles.hdrBtnText, styles.hdrDone]}>Done</Text>
                </TouchableOpacity>
              </View>
              {iosWhich ? (
                <DateTimePicker
                  value={iosDraft}
                  mode="date"
                  display="spinner"
                  themeVariant="light"
                  onChange={(_e, d) => {
                    if (d) setIosDraft(d);
                  }}
                />
              ) : null}
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}
    </View>
  );
};
