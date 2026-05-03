import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon, PrimaryButton } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { getAssistantChatSession } from '../backend/assistantChatHistoryService';
import type { AssistantChatDetail } from '../backend/assistantChatHistoryService';
import { extractApiError } from '../backend/apiClient';
import type { HistoryStackParamList } from '../types/navigation';
import { navigateToHomeChatAssistant } from '../navigation/historyCrossTabNavigate';

type Nav = NativeStackNavigationProp<HistoryStackParamList, 'AssistantHistoryDetail'>;
type R = RouteProp<HistoryStackParamList, 'AssistantHistoryDetail'>;

export const AssistantHistoryDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { spacing, fontSizes } = useResponsive();
  const [doc, setDoc] = useState<AssistantChatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await getAssistantChatSession(route.params.id);
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
        bubble: {
          marginBottom: spacing.md,
          padding: spacing.md,
          borderRadius: 12,
          maxWidth: '92%',
        },
        userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
        modelBubble: { alignSelf: 'flex-start', backgroundColor: colors.card },
        userText: { color: '#fff', fontSize: fontSizes.sm, lineHeight: fontSizes.sm * 1.4 },
        modelText: { color: colors.text, fontSize: fontSizes.sm, lineHeight: fontSizes.sm * 1.4 },
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
          Assistant chat
        </Text>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} /> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {!loading && doc ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {(doc.messages || []).map((m, i) => (
            <View
              key={i}
              style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.modelBubble]}
            >
              <Text style={m.role === 'user' ? styles.userText : styles.modelText}>{m.content}</Text>
            </View>
          ))}
          <PrimaryButton
            style={styles.btn}
            title="Continue chat"
            onPress={() => {
              navigateToHomeChatAssistant(navigation, { sessionId: doc._id });
            }}
          />
        </ScrollView>
      ) : null}
    </View>
  );
};
