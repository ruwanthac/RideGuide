import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ChatBubble, Icon, TypingIndicator } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { askAssistant, AssistantMsg } from '../backend/assistantService';
import { getAssistantChatSession } from '../backend/assistantChatHistoryService';
import { useVehicles } from '../context/VehiclesContext';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
  imageUri?: string | null;
}

interface ChatAssistantScreenProps {
  onBack: () => void;
  onVideoCallPress?: () => void;
  /** Open assistant with an existing saved session (from History). */
  initialSessionId?: string;
}

export const ChatAssistantScreen: React.FC<ChatAssistantScreenProps> = ({
  onBack,
  onVideoCallPress,
  initialSessionId,
}) => {
  const { spacing, fontSizes, iconSizes, scale, borderRadius } = useResponsive();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hi! I\'m your AI vehicle assistant. How can I help you today?',
      isUser: false,
      timestamp: '10:30',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const assistantSessionIdRef = useRef<string | null>(null);
  const { selectedVehicle, vehicles, selectedVehicleId } = useVehicles();
  const effectiveVehicleId =
    selectedVehicle?._id ??
    vehicles.find((v) => v._id === selectedVehicleId)?._id ??
    vehicles[0]?._id;

  useEffect(() => {
    if (!initialSessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const doc = await getAssistantChatSession(initialSessionId);
        if (cancelled) return;
        assistantSessionIdRef.current = doc._id;
        const time = new Date(doc.updatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const mapped: Message[] = (doc.messages || []).map((m, i) => ({
          id: `loaded-${i}-${m.role}`,
          text: m.content,
          isUser: m.role === 'user',
          timestamp: time,
        }));
        if (mapped.length) setMessages(mapped);
      } catch {
        // keep default greeting
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialSessionId]);

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo library access required',
        'Please allow photo library access to attach vehicle images.'
      );
      return false;
    }
    return true;
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera access required',
        'Please allow camera access to take photos.'
      );
      return false;
    }
    return true;
  };

  const handlePickImage = async () => {
    if (!(await requestMediaLibraryPermission())) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPendingImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to open photo library.');
    }
  };

  const handleTakePhoto = async () => {
    if (!(await requestCameraPermission())) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPendingImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to open camera.');
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
          backgroundColor: '#FFFFFF',
          paddingTop: Platform.OS === 'ios' ? spacing.xl + spacing.md : StatusBar.currentHeight || spacing.lg,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: '#E4E6EB',
          flexDirection: 'row',
          alignItems: 'center',
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
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
          color: '#111B21',
          flex: 1,
        },
        videoCallButton: {
          width: scale(40),
          height: scale(40),
          borderRadius: scale(20),
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: spacing.md,
        },
        chatContainer: {
          flex: 1,
          backgroundColor: '#F0F2F5',
        },
        messageList: {
          padding: spacing.md,
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
        attachButton: {
          width: scale(44),
          height: scale(44),
          borderRadius: scale(22),
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.sm,
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
        pendingImagePreview: {
          width: scale(60),
          height: scale(60),
          borderRadius: borderRadius.md,
          backgroundColor: colors.border,
          marginRight: spacing.sm,
          overflow: 'hidden',
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
    [spacing, fontSizes, iconSizes, scale, borderRadius]
  );

  const handleAttachPress = () => {
    Alert.alert(
      'Upload Image',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Gallery', onPress: handlePickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const scrollToBottom = React.useCallback(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text && !pendingImageUri) return;

    const imgUri = pendingImageUri;
    const userMessage: Message = {
      id: Date.now().toString(),
      text: text || (imgUri ? 'Vehicle image' : ''),
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      imageUri: imgUri ?? undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setPendingImageUri(null);
    setIsTyping(true);
    scrollToBottom();

    try {
      const history: AssistantMsg[] = [...messages, userMessage].map((m) => ({
        role: m.isUser ? 'user' : 'model',
        content: m.text,
      }));
      const { reply, sessionId } = await askAssistant(history, {
        sessionId: assistantSessionIdRef.current ?? undefined,
        vehicleId: effectiveVehicleId ?? undefined,
      });
      if (sessionId) assistantSessionIdRef.current = sessionId;
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: reply,
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: 'Sorry, the assistant is unreachable right now. Please try again.',
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Icon name="close" size={iconSizes.md} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Assistant</Text>
        {onVideoCallPress && (
          <TouchableOpacity
            style={styles.videoCallButton}
            onPress={onVideoCallPress}
            activeOpacity={0.7}
          >
            <Icon name="videocam" size={iconSizes.md} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

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
              imageUri={item.imageUri}
            />
          )}
          contentContainerStyle={styles.messageList}
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          onContentSizeChange={scrollToBottom}
          keyboardShouldPersistTaps="handled"
        />

        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleAttachPress}
            activeOpacity={0.7}
          >
            <Icon name="image" size={iconSizes.lg} color={colors.primary} />
          </TouchableOpacity>
          {pendingImageUri ? (
            <TouchableOpacity
              style={styles.pendingImagePreview}
              onPress={() => setPendingImageUri(null)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: pendingImageUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : null}
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
            style={[styles.sendButton, !inputText.trim() && !pendingImageUri && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() && !pendingImageUri}
            activeOpacity={0.7}
          >
            <Icon name="send" size={iconSizes.sm} color={colors.card} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};
