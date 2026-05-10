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
  bubbleTone?: 'owner' | 'tow' | 'default';
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isUser,
  timestamp,
  imageUri,
  alignRight,
  bubbleTone = 'default',
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
        userBubble: {
          backgroundColor: colors.primary,
          borderBottomRightRadius: borderRadius.sm,
        },
        ownerBubble: {
          backgroundColor: '#1D4ED8',
          borderBottomRightRadius: borderRadius.sm,
        },
        towBubble: {
          backgroundColor: '#0F766E',
          borderBottomLeftRadius: borderRadius.sm,
        },
        aiBubble: {
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
        userText: { color: colors.card },
        roleText: { color: '#FFFFFF' },
        aiText: { color: colors.text },
        timestamp: {
          fontSize: fontSizes.xs - 1,
          marginTop: spacing.xs,
        },
        userTimestamp: { color: 'rgba(255, 255, 255, 0.8)' },
        aiTimestamp: { color: colors.textSecondary },
      }),
    [spacing, borderRadius, fontSizes, scale]
  );

  const rightAligned = typeof alignRight === 'boolean' ? alignRight : isUser;
  const bubbleStyle =
    bubbleTone === 'owner'
      ? styles.ownerBubble
      : bubbleTone === 'tow'
        ? styles.towBubble
        : isUser
          ? styles.userBubble
          : styles.aiBubble;
  const textStyle = bubbleTone === 'default' ? (isUser ? styles.userText : styles.aiText) : styles.roleText;
  const timestampStyle =
    bubbleTone === 'default'
      ? isUser
        ? styles.userTimestamp
        : styles.aiTimestamp
      : styles.userTimestamp;

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
