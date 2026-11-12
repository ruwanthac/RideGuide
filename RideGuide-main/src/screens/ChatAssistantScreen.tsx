import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  StatusBar,
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { askAssistant, AssistantMsg } from '../backend/assistantService';
import { getAssistantChatSession } from '../backend/assistantChatHistoryService';
import { useVehicles } from '../context/VehiclesContext';
import { friendlyErrorMessage } from '../backend/apiClient';

async function imageUriToBase64(uri: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const mime =
    blob.type && /^image\//i.test(blob.type)
      ? blob.type
      : uri.toLowerCase().includes('png')
        ? 'image/png'
        : 'image/jpeg';
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return { base64, mime };
}

interface Message {
  id: string;
  /** Text sent to the AI (a photo-only message is sent as "Vehicle image") */
  text: string;
  /** Text shown in the bubble; empty for a photo sent without a caption */
  displayText?: string;
  isUser: boolean;
  /** Epoch ms; drives the time under each group and the Today / Yesterday dividers */
  createdAt: number;
  imageUri?: string | null;
  /** The assistant couldn't answer; shown in a muted error style */
  isError?: boolean;
}


const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const SCREEN_BG = '#F4F6FA';
/** Messages from the same sender within this gap share one time label and avatar */
const GROUP_GAP_MS = 5 * 60 * 1000;

type Row =
  | { kind: 'divider'; key: string; label: string }
  | { kind: 'message'; key: string; message: Message; firstInGroup: boolean; lastInGroup: boolean };

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(ms: number): string {
  const day = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Adds day dividers and marks where each run of messages from one sender starts and ends. */
function buildRows(messages: Message[]): Row[] {
  const rows: Row[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    if (!prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt)) {
      rows.push({ kind: 'divider', key: `day-${m.id}`, label: dayLabel(m.createdAt) });
    }
    const sameAs = (o?: Message) =>
      !!o && o.isUser === m.isUser && Math.abs(o.createdAt - m.createdAt) < GROUP_GAP_MS && dayLabel(o.createdAt) === dayLabel(m.createdAt);
    rows.push({ kind: 'message', key: m.id, message: m, firstInGroup: !sameAs(prev), lastInGroup: !sameAs(next) });
  });
  return rows;
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
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hi! I\'m your AI vehicle assistant. How can I help you today?',
      isUser: false,
      createdAt: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
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
        // Saved chats only keep the session's last update time, so loaded messages share it.
        const savedAt = Date.parse(doc.updatedAt) || Date.now();
        const mapped: Message[] = (doc.messages || []).map((m, i) => ({
          id: `loaded-${i}-${m.role}`,
          text: m.content,
          isUser: m.role === 'user',
          createdAt: savedAt,
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

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const subHide = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

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
        quality: 0.65,
      });
      if (!result.canceled && result.assets[0]) {
        setPendingImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Couldn't open photos", 'Please check that the app is allowed to access your photos, then try again.');
    }
  };

  const handleTakePhoto = async () => {
    if (!(await requestCameraPermission())) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.65,
      });
      if (!result.canceled && result.assets[0]) {
        setPendingImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Couldn't open the camera", 'Please check that the app is allowed to use the camera, then try again.');
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: SCREEN_BG },
        header: {
          backgroundColor: '#FFFFFF',
          paddingBottom: 10,
          paddingHorizontal: 12,
          borderBottomWidth: 1,
          borderBottomColor: LINE,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
        avatarLg: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
        headerTitle: { fontSize: 16, fontWeight: '700', color: INK },
        headerStatus: { fontSize: 12, fontWeight: '600', marginTop: 1 },
        videoButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: LINE,
          alignItems: 'center',
          justifyContent: 'center',
        },
        chatContainer: { flex: 1 },
        messageList: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
        divider: {
          alignSelf: 'center',
          fontSize: 12,
          fontWeight: '600',
          color: MUTED,
          backgroundColor: LINE,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          overflow: 'hidden',
          marginVertical: 8,
        },
        row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
        avatarSm: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
        avatarSpacer: { width: 28 },
        bubble: { paddingHorizontal: 14, paddingVertical: 10, maxWidth: '100%' },
        userBubble: { backgroundColor: colors.primary, borderRadius: 18 },
        aiBubble: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 18 },
        errorBubble: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 18 },
        userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
        aiText: { color: INK, fontSize: 15, lineHeight: 21 },
        errorText: { color: '#991B1B', fontSize: 15, lineHeight: 21 },
        photo: { width: 220, height: 165, borderRadius: 18, backgroundColor: LINE },
        meta: { fontSize: 11, color: MUTED, marginTop: 3 },
        typingBubble: {
          flexDirection: 'row',
          gap: 5,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: LINE,
          borderRadius: 18,
          borderBottomLeftRadius: 6,
          paddingHorizontal: 16,
          paddingVertical: 14,
        },
        typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#94A3B8' },
        inputBar: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: LINE,
          paddingHorizontal: 12,
          paddingTop: 10,
        },
        pending: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
        pendingImage: { width: 56, height: 56, borderRadius: 12, backgroundColor: LINE },
        pendingText: { flex: 1, fontSize: 13, color: MUTED },
        inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
        plusButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
        input: {
          flex: 1,
          minHeight: 44,
          maxHeight: 120,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: LINE,
          backgroundColor: '#F8FAFC',
          paddingHorizontal: 16,
          paddingTop: Platform.OS === 'ios' ? 12 : 10,
          paddingBottom: Platform.OS === 'ios' ? 12 : 10,
          fontSize: 15,
          color: INK,
        },
        sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
        sendDisabled: { backgroundColor: '#BFDBFE' },
        pressed: { opacity: 0.85 },
      }),
    []
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

  const scrollToBottom = useCallback(() => {
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
      displayText: text,
      isUser: true,
      createdAt: Date.now(),
      imageUri: imgUri ?? undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setPendingImageUri(null);
    setIsTyping(true);
    scrollToBottom();

    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;
    if (imgUri) {
      try {
        const conv = await imageUriToBase64(imgUri);
        imageBase64 = conv.base64;
        imageMimeType = conv.mime;
      } catch {
        setMessages((prev) => prev.filter((x) => x.id !== userMessage.id));
        setIsTyping(false);
        Alert.alert("Couldn't use that photo", 'Please try another photo or take a new one.');
        return;
      }
    }

    try {
      const combined = [...messages, userMessage];
      const history: AssistantMsg[] = combined.map((m, i) => {
        const isLast = i === combined.length - 1;
        if (isLast && m.isUser && imageBase64 && imageMimeType) {
          return {
            role: 'user',
            content: m.text || '',
            imageBase64,
            imageMimeType,
          };
        }
        return { role: m.isUser ? 'user' : 'model', content: m.text };
      });
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
          createdAt: Date.now(),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: friendlyErrorMessage(e, "Sorry, I can't reach the assistant right now. Please try again."),
          isUser: false,
          createdAt: Date.now(),
          isError: true,
        },
      ]);
    } finally {
      setIsTyping(false);
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  };

  const rows = useMemo(() => buildRows(messages), [messages]);
  const canSend = !!inputText.trim() || !!pendingImageUri;
  const lastUserIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].isUser) return i;
    return -1;
  }, [messages]);
  // "Read" once the assistant is answering, or has answered, the latest message.
  const lastUserRead = lastUserIndex >= 0 && (isTyping || lastUserIndex < messages.length - 1);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'divider') {
      return <Text style={styles.divider}>{item.label}</Text>;
    }
    const m = item.message;
    const time = formatTime(m.createdAt);
    const isLastUser = m.isUser && messages[lastUserIndex]?.id === m.id;
    const shownText = m.isUser ? m.displayText ?? m.text : m.text;
    const bubbleRadius = m.isUser
      ? { borderBottomRightRadius: item.lastInGroup ? 6 : 18 }
      : { borderBottomLeftRadius: item.lastInGroup ? 6 : 18 };
    const content = (
      <View style={{ alignItems: m.isUser ? 'flex-end' : 'flex-start', gap: 6, flexShrink: 1 }}>
        {m.imageUri ? (
          <Image source={{ uri: m.imageUri }} style={styles.photo} resizeMode="cover" accessibilityLabel="Photo you sent" />
        ) : null}
        {shownText ? (
          <View style={[styles.bubble, m.isUser ? styles.userBubble : m.isError ? styles.errorBubble : styles.aiBubble, bubbleRadius]}>
            <Text style={m.isUser ? styles.userText : m.isError ? styles.errorText : styles.aiText} selectable>
              {shownText}
            </Text>
          </View>
        ) : null}
        {item.lastInGroup ? (
          <Text style={styles.meta}>
            {time}
            {isLastUser && lastUserRead ? ' · Read' : ''}
          </Text>
        ) : null}
      </View>
    );
    return (
      <View
        style={[
          styles.row,
          { justifyContent: m.isUser ? 'flex-end' : 'flex-start', marginTop: item.firstInGroup ? 10 : 3 },
          m.isUser ? { paddingLeft: 56 } : { paddingRight: 40 },
        ]}
      >
        {!m.isUser ? (
          item.lastInGroup ? (
            <View style={[styles.avatarSm, { marginBottom: 18 }]}>
              <Icon name="sparkles" size={14} color="#1D4ED8" />
            </View>
          ) : (
            <View style={styles.avatarSpacer} />
          )
        ) : null}
        {content}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevron-back" size={24} color={INK} />
        </Pressable>
        <View style={styles.avatarLg}>
          <Icon name="sparkles" size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            AI Assistant
          </Text>
          <Text
            style={[styles.headerStatus, { color: isTyping ? '#15803D' : MUTED }]}
            accessibilityLiveRegion="polite"
          >
            {isTyping ? 'Typing…' : 'Usually replies in seconds'}
          </Text>
        </View>
        {onVideoCallPress ? (
          <Pressable
            style={({ pressed }) => [styles.videoButton, pressed && styles.pressed]}
            onPress={onVideoCallPress}
            accessibilityRole="button"
            accessibilityLabel="Start a video call with the Vehicle Expert"
          >
            <Icon name="videocam" size={20} color={INK} />
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView style={styles.chatContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={flatListRef}
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          contentContainerStyle={styles.messageList}
          ListFooterComponent={
            isTyping ? (
              <View style={[styles.row, { marginTop: 10 }]} accessibilityLabel="AI Assistant is typing">
                <View style={styles.avatarSm}>
                  <Icon name="sparkles" size={14} color="#1D4ED8" />
                </View>
                <View style={styles.typingBubble}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </View>
              </View>
            ) : null
          }
          onContentSizeChange={scrollToBottom}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />

        <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? 10 : Math.max(insets.bottom, 12) }]}>
          {pendingImageUri ? (
            <View style={styles.pending}>
              <Image source={{ uri: pendingImageUri }} style={styles.pendingImage} resizeMode="cover" accessibilityLabel="Photo to send" />
              <Text style={styles.pendingText}>Photo ready. Add a question, or just send it.</Text>
              <Pressable
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                onPress={() => setPendingImageUri(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <Icon name="close" size={20} color={MUTED} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <Pressable
              style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}
              onPress={handleAttachPress}
              accessibilityRole="button"
              accessibilityLabel="Add a photo"
            >
              <Icon name="add" size={22} color={INK} />
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Message the AI Assistant"
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              accessibilityLabel="Message"
            />
            <Pressable
              style={({ pressed }) => [styles.sendButton, !canSend && styles.sendDisabled, pressed && canSend && styles.pressed]}
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !canSend }}
            >
              <Icon name="arrow-up" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};
