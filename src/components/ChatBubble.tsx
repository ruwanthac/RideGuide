import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isUser,
  timestamp,
}) => {
  const { spacing, borderRadius, fontSizes } = useResponsive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { marginVertical: spacing.sm },
        userContainer: { alignItems: 'flex-end' },
        aiContainer: { alignItems: 'flex-start' },
        bubble: {
          maxWidth: '85%',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: borderRadius.lg,
        },
        userBubble: {
          backgroundColor: colors.primary,
          borderBottomRightRadius: 4,
        },
        aiBubble: {
          backgroundColor: colors.card,
          borderBottomLeftRadius: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        },
        message: { fontSize: fontSizes.md },
        userText: { color: colors.card },
        aiText: { color: colors.text },
        timestamp: {
          fontSize: fontSizes.xs - 1,
          marginTop: spacing.xs,
        },
        userTimestamp: { color: 'rgba(255, 255, 255, 0.8)' },
        aiTimestamp: { color: colors.textSecondary },
      }),
    [spacing, borderRadius, fontSizes]
  );

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={StyleSheet.flatten([styles.message, isUser ? styles.userText : styles.aiText])}>
          {message}
        </Text>
        {timestamp ? (
          <Text
            style={StyleSheet.flatten([
              styles.timestamp,
              isUser ? styles.userTimestamp : styles.aiTimestamp,
            ])}
          >
            {timestamp}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
