import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { joinLiveAiCall } from '../backend/liveAiCallService';

const RINGTONE_SOURCE = require('../../assets/call.mp3');

interface VideoCallScreenProps {
  onEndCall: () => void;
}

interface LiveMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
}

export const VideoCallScreen: React.FC<VideoCallScreenProps> = ({ onEndCall }) => {
  const { spacing, fontSizes, scale } = useResponsive();
  const [status, setStatus] = useState<
    'calling' | 'connecting' | 'connected' | 'error' | 'ended'
  >('calling');
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const [isMuted, setIsMuted] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const [permission, requestPermission] = useCameraPermissions();
  const sessionIdRef = useRef<string>(`ai-call-${Date.now()}`);
  const sendRef = useRef<null | ((text: string) => Promise<void>)>(null);
  const stopRef = useRef<null | (() => Promise<void>)>(null);

  const toggleCamera = () => {
    setCameraFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const ringtonePlayer = useAudioPlayer(RINGTONE_SOURCE);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
      } catch {
        // Ignore
      }
    };
    setupAudio();
  }, []);

  const safePause = () => {
    try {
      ringtonePlayer.pause();
    } catch {
      // Native object may already be released on unmount
    }
  };

  useEffect(() => {
    if (status === 'calling') {
      ringtonePlayer.loop = true;
      ringtonePlayer.play();
    } else {
      safePause();
    }
    return () => safePause();
  }, [status]);

  useEffect(() => {
    let active = true;
    setStatus('connecting');
    setSessionError(null);
    (async () => {
      try {
        const sessionId = sessionIdRef.current;
        const session = await joinLiveAiCall(sessionId, {
          onReady: () => {
            if (!active) return;
            setStatus('connected');
          },
          onUserText: (text) => {
            if (!active) return;
            setMessages((prev) => [
              ...prev,
              { id: `${Date.now()}-${Math.random()}`, role: 'user', content: text },
            ]);
          },
          onAgentText: (text) => {
            if (!active) return;
            setMessages((prev) => [
              ...prev,
              { id: `${Date.now()}-${Math.random()}`, role: 'model', content: text },
            ]);
          },
          onError: (message) => {
            if (!active) return;
            setStatus('error');
            setSessionError(message);
          },
          onEnded: () => {
            if (!active) return;
            setStatus('ended');
          },
        });
        sendRef.current = session.sendText;
        stopRef.current = session.stop;
      } catch (e) {
        if (!active) return;
        setStatus('error');
        setSessionError(
          e instanceof Error
            ? e.message
            : 'Failed to connect to AI assistant. Ensure backend is running and you are logged in.'
        );
      }
    })();

    return () => {
      active = false;
      void stopRef.current?.();
    };
  }, []);

  const handleEndCall = () => {
    safePause();
    void stopRef.current?.();
    onEndCall();
  };

  const handleSendQuestion = async () => {
    const cleaned = inputText.trim();
    if (!cleaned || !sendRef.current || isSending) return;
    try {
      setIsSending(true);
      setSessionError(null);
      await sendRef.current(cleaned);
      setInputText('');
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : 'Failed to send question.');
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    requestPermission();
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      { iterations: -1 }
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const statusText =
    status === 'calling'
      ? 'Calling...'
      : status === 'connecting'
      ? 'Connecting to AI...'
      : status === 'connected'
      ? 'Connected to AI'
      : status === 'ended'
      ? 'Call ended'
      : 'Connection issue';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: '#1a1a2e',
        },
        remoteVideo: {
          flex: 1,
          backgroundColor: '#16213e',
          overflow: 'hidden',
        },
        camera: {
          flex: 1,
        },
        remotePlaceholder: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarLarge: {
          width: scale(100),
          height: scale(100),
          borderRadius: scale(50),
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
        },
        remoteName: {
          fontSize: fontSizes.xl,
          fontWeight: '600',
          color: '#FFFFFF',
        },
        localLabel: {
          fontSize: fontSizes.xs,
          color: 'rgba(255,255,255,0.8)',
          marginTop: spacing.xs,
        },
        enableCameraButton: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.lg,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.primary,
          borderRadius: 12,
        },
        statusBar: {
          position: 'absolute',
          top: spacing.xl * 2,
          left: 0,
          right: 0,
          alignItems: 'center',
        },
        statusText: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: '#FFFFFF',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: 'rgba(0,0,0,0.4)',
          borderRadius: 20,
        },
        controls: {
          position: 'absolute',
          bottom: scale(250),
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        },
        controlButton: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: 'rgba(255,255,255,0.2)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        endCallButton: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#DC2626',
          alignItems: 'center',
          justifyContent: 'center',
        },
        chatPanel: {
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          bottom: spacing.md,
          maxHeight: scale(220),
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: 14,
          padding: spacing.sm,
        },
        chatList: {
          maxHeight: scale(140),
          marginBottom: spacing.sm,
        },
        chatRow: {
          marginBottom: spacing.xs,
          alignSelf: 'flex-start',
          maxWidth: '92%',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.16)',
        },
        chatRowUser: {
          alignSelf: 'flex-end',
          backgroundColor: 'rgba(37,99,235,0.6)',
        },
        chatText: {
          color: '#FFFFFF',
          fontSize: fontSizes.sm,
        },
        chatInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        chatInput: {
          flex: 1,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.14)',
          color: '#FFFFFF',
          fontSize: fontSizes.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        chatSendBtn: {
          marginLeft: spacing.sm,
          width: scale(40),
          height: scale(40),
          borderRadius: scale(20),
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        chatSendBtnDisabled: {
          opacity: 0.5,
        },
        errorText: {
          color: '#FECACA',
          fontSize: fontSizes.xs,
          marginBottom: spacing.xs,
        },
      }),
    [spacing, fontSizes, scale]
  );

  const showCamera = permission?.granted;

  return (
    <View style={styles.container}>
      <View style={styles.remoteVideo}>
        {showCamera ? (
          <CameraView style={styles.camera} facing={cameraFacing} />
        ) : (
          <View style={styles.remotePlaceholder}>
            <Animated.View
              style={[
                styles.avatarLarge,
                { transform: [{ scale: status === 'calling' ? pulseAnim : 1 }] },
              ]}
            >
              <Icon name="person" size={scale(50)} color="#FFFFFF" />
            </Animated.View>
            <Text style={styles.remoteName}>Vehicle Expert</Text>
            {!permission?.granted && (
              <TouchableOpacity
                style={styles.enableCameraButton}
                onPress={requestPermission}
                activeOpacity={0.8}
              >
                <Icon name="camera" size={24} color="#FFFFFF" />
                <Text
                  style={StyleSheet.flatten([
                    styles.remoteName,
                    { marginLeft: spacing.sm, fontSize: fontSizes.md },
                  ])}
                >
                  Enable Camera
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            { marginRight: spacing.xl },
            isMuted && { backgroundColor: 'rgba(220, 38, 38, 0.6)' },
          ]}
          onPress={toggleMute}
          activeOpacity={0.7}
        >
          <Icon
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.endCallButton}
          onPress={handleEndCall}
          activeOpacity={0.7}
        >
          <Icon name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, { marginLeft: spacing.xl }]}
          onPress={toggleCamera}
          activeOpacity={0.7}
          disabled={!showCamera}
        >
          <Icon name="camera-reverse" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? scale(24) : 0}
        style={styles.chatPanel}
      >
        {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.chatList}
          renderItem={({ item }) => (
            <View style={[styles.chatRow, item.role === 'user' && styles.chatRowUser]}>
              <Text style={styles.chatText}>{item.content}</Text>
            </View>
          )}
        />
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            value={inputText}
            onChangeText={setInputText}
            editable={status === 'connected' && !isSending}
            placeholder="Ask the AI about your vehicle..."
            placeholderTextColor="rgba(255,255,255,0.72)"
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.chatSendBtn,
              (!inputText.trim() || status !== 'connected' || isSending) &&
                styles.chatSendBtnDisabled,
            ]}
            disabled={!inputText.trim() || status !== 'connected' || isSending}
            onPress={handleSendQuestion}
            activeOpacity={0.8}
          >
            <Icon name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};
