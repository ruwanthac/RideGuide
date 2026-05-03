import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon, PrimaryButton } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { getAiCallHistory } from '../backend/aiCallHistoryService';
import type { AiCallHistoryDetail } from '../backend/aiCallHistoryService';
import { extractApiError } from '../backend/apiClient';
import type { HistoryStackParamList } from '../types/navigation';
import { navigateToHomeVideoCall } from '../navigation/historyCrossTabNavigate';

type Nav = NativeStackNavigationProp<HistoryStackParamList, 'AiVideoHistoryDetail'>;
type R = RouteProp<HistoryStackParamList, 'AiVideoHistoryDetail'>;

export const AiVideoHistoryDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { spacing, fontSizes } = useResponsive();
  const [doc, setDoc] = useState<AiCallHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await getAiCallHistory(route.params.id);
        if (!cancelled) setDoc(d);
      } catch (e) {
        if (!cancelled) {
          setError(extractApiError(e));
          setDoc(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route.params.id]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: spacing.xl * 2,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
        },
        back: { marginRight: spacing.md, padding: spacing.xs },
        title: { flex: 1, fontSize: fontSizes.lg, fontWeight: '700', color: colors.text },
        scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
        summary: { fontSize: fontSizes.md, color: colors.text, lineHeight: fontSizes.md * 1.45, marginBottom: spacing.lg },
        h: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.md },
        line: { fontSize: fontSizes.sm, color: colors.text, marginTop: spacing.xs, lineHeight: fontSizes.sm * 1.4 },
        err: { color: '#B91C1C', paddingHorizontal: spacing.lg },
        btn: { marginTop: spacing.lg },
      }),
    [spacing, fontSizes]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Icon name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Video call
        </Text>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} /> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {!loading && doc ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.summary}>{doc.summary}</Text>
          <Text style={styles.h}>Transcript</Text>
          {(doc.messages || []).map((m, i) => (
            <Text key={i} style={styles.line}>
              {m.role === 'user' ? 'You' : 'AI'}: {m.content}
            </Text>
          ))}
          <PrimaryButton
            style={styles.btn}
            title="Continue chat"
            onPress={() => {
              navigateToHomeVideoCall(navigation, {
                priorConversationSummary: doc.summary,
                vehicleId: doc.vehicleId || undefined,
              });
            }}
          />
        </ScrollView>
      ) : null}
    </View>
  );
};
