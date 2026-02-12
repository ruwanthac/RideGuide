import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Header, ChatBubble, Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

interface ChatAssistantScreenProps {
  onBack: () => void;
}

export const ChatAssistantScreen: React.FC<ChatAssistantScreenProps> = ({ onBack }) => {
  const { spacing, fontSizes, iconSizes, scale } = useResponsive();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hi! I\'m your AI vehicle assistant. How can I help you today?',
      isUser: false,
      timestamp: '10:30',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        chatContainer: { flex: 1 },
        messageList: {
          padding: spacing.lg,
          paddingBottom: spacing.md,
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
    [spacing, fontSizes, iconSizes, scale]
  );

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Thanks for your message. I\'ll help you diagnose your vehicle issue. Could you provide more details about the symptoms you\'re experiencing?',
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <Header title="AI Assistant" showBack onBackPress={onBack} />

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble
              message={item.text}
              isUser={item.isUser}
              timestamp={item.timestamp}
            />
          )}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Icon name="send" size={iconSizes.sm} color={colors.card} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};
