import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { ChatBubble, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { joinChat } from '../backend/chatService';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage } from '../backend/types';

export interface RequestChatScreenParams {
  requestId: string;
  userName: string;
  vehicle: string;
  issue: string;
}

interface RequestChatScreenProps {
  onBack: () => void;
  requestId: string;
  userName: string;
  vehicle: string;
  issue: string;
}

export const RequestChatScreen: React.FC<RequestChatScreenProps> = ({
  onBack,
  requestId,
  userName,
  vehicle,
  issue,
}) => {
  const { spacing, fontSizes, iconSizes, scale, borderRadius } = useResponsive();
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sendRef = useRef<null | ((t: string) => Promise<void>)>(null);
  const leaveRef = useRef<null | (() => void)>(null);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { recent, send, leave } = await joinChat(requestId, (m) => {
          if (!alive) return;
          setMessages((prev) => [...prev, m]);
        });
        if (!alive) { leave(); return; }
        setMessages(recent);
        sendRef.current = send;
        leaveRef.current = leave;
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Chat unavailable');
      }
    })();
    return () => {
      alive = false;
      leaveRef.current?.();
    };
  }, [requestId]);

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !sendRef.current) return;
    try {
      await sendRef.current(trimmed);
      setInputText('');
      scrollToBottom();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: '#F0F2F5',
        },
        header: {
          backgroundColor: colors.card,
          paddingTop: Platform.OS === 'ios' ? spacing.xl + spacing.md : (StatusBar.currentHeight ?? 0) + spacing.md,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
        },
        backButton: {
          width: scale(40),
          height: scale(40),
          borderRadius: scale(20),
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
        },
        headerTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
          flex: 1,
        },
        chatContainer: {
          flex: 1,
          backgroundColor: '#F0F2F5',
        },
        messageList: {
          padding: spacing.md,
          paddingBottom: spacing.md,
        },
        errorBanner: {
          backgroundColor: '#FDECEA',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        errorText: {
          color: '#B00020',
          fontSize: fontSizes.sm,
        },
        inputBar: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          padding: spacing.md,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        input: {
          flex: 1,
          backgroundColor: colors.background,
          borderRadius: scale(24),
          paddingVertical: spacing.sm + 4,
          paddingHorizontal: spacing.lg,
          fontSize: fontSizes.md,
          color: colors.text,
          maxHeight: scale(100),
          marginRight: spacing.sm,
        },
        sendButton: {
          width: scale(44),
          height: scale(44),
          borderRadius: scale(22),
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sendDisabled: { opacity: 0.5 },
      }),
    [spacing, fontSizes, scale]
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Icon name="chevron-back" size={iconSizes.md} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Chat with {userName}</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ChatBubble
              message={item.text}
              isUser={item.senderId === user?._id}
              timestamp={new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            />
          )}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToBottom}
          keyboardShouldPersistTaps="handled"
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Icon name="send" size={iconSizes.md} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};
