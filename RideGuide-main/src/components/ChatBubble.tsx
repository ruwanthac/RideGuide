import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors, shadows } from '../constants/theme';
import { useResponsive } from '../hooks';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  imageUri?: string | null;
  alignRight?: boolean;
  /** @deprecated Kept for API compatibility; bubbles are styled by sent vs received only. */
  bubbleTone?: 'owner' | 'tow' | 'default';
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isUser,
  timestamp,
  imageUri,
  alignRight,
}) => {
  const { spacing, borderRadius, fontSizes, scale } = useResponsive();

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
        bubbleImage: {
          width: scale(200),
          height: scale(150),
          borderRadius: borderRadius.md,
          marginBottom: spacing.sm,
        },
        /** Sent by current user */
        sentBubble: {
          backgroundColor: colors.primary,
          borderBottomRightRadius: borderRadius.sm,
        },
        /** Received from the other party */
        receivedBubble: {
          backgroundColor: colors.card,
          borderBottomLeftRadius: borderRadius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.sm,
        },
        message: {
          fontSize: fontSizes.md,
          lineHeight: Math.round(fontSizes.md * 1.45),
        },
        sentText: { color: '#FFFFFF' },
        receivedText: { color: colors.text },
        timestamp: {
          fontSize: fontSizes.xs - 1,
          marginTop: spacing.xs,
        },
        sentTimestamp: { color: 'rgba(255, 255, 255, 0.85)' },
        receivedTimestamp: { color: colors.textSecondary },
      }),
    [spacing, borderRadius, fontSizes, scale]
  );

  const rightAligned = typeof alignRight === 'boolean' ? alignRight : isUser;
  const bubbleStyle = rightAligned ? styles.sentBubble : styles.receivedBubble;
  const textStyle = rightAligned ? styles.sentText : styles.receivedText;
  const timestampStyle = rightAligned ? styles.sentTimestamp : styles.receivedTimestamp;

  return (
    <View style={[styles.container, rightAligned ? styles.userContainer : styles.aiContainer]}>
      <View style={[styles.bubble, bubbleStyle]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.bubbleImage} resizeMode="cover" />
        ) : null}
        {message ? (
        <Text style={StyleSheet.flatten([styles.message, textStyle])}>
          {message}
        </Text>
        ) : null}
        {timestamp ? (
          <Text
            style={StyleSheet.flatten([
              styles.timestamp,
              timestampStyle,
            ])}
          >
            {timestamp}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
