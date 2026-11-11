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
  PanResponder,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  useAudioPlayer,
  useAudioRecorder,
  createAudioPlayer,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  IOSOutputFormat,
  AudioQuality,
} from 'expo-audio';
import type { RecordingOptions, AudioPlayer } from 'expo-audio';
import { File as FSFile, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Icon } from '../components';
import { colors, shadows } from '../constants/theme';
import { useResponsive } from '../hooks';
import { joinLiveAiCall } from '../backend/liveAiCallService';
import { useVehicles } from '../context/VehiclesContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { friendlyErrorMessage } from '../backend/apiClient';

const RINGTONE_SOURCE = require('../../assets/call.mp3');
const SEND_TONE_SOURCE = require('../../assets/send_tone.wav');
const AUDIO_MIME_TYPE = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
const AGENT_AUDIO_PRIORITY_WINDOW_MS = 1200;
const SNAPSHOT_MIN_INTERVAL_MS = 1500;
const CAPTION_SMOOTHING_MS = 120;

const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

/** Dark call chrome — neutrals + app primary / error for accents */
const call = {
  bg: '#0B1220',
  cameraArea: '#0F172A',
  overlayPill: 'rgba(15,23,42,0.82)',
  panel: 'rgba(15,23,42,0.58)',
  border: 'rgba(248,250,252,0.12)',
  borderStrong: 'rgba(248,250,252,0.24)',
  text: '#F8FAFC',
  textMuted: 'rgba(248,250,252,0.78)',
  textSubtle: 'rgba(248,250,252,0.52)',
  textCaption: 'rgba(248,250,252,0.5)',
  micIdleBg: 'rgba(15,23,42,0.65)',
  micActiveBg: 'rgba(37,99,235,0.9)',
  micActiveBorder: 'rgba(191,219,254,0.95)',
  ripple: 'rgba(96,165,250,0.55)',
  userBubble: 'rgba(37,99,235,0.82)',
  aiBubble: 'rgba(248,250,252,0.11)',
  inputBg: 'rgba(30, 41, 59, 0.98)',
  controlIdle: 'rgba(248,250,252,0.14)',
  errorSoft: '#FECACA',
} as const;

function normalizeAgentText(text: string): string {
  return text
    .replace(/\(No audio was provided, so I cannot generate audio output\.\)/gi, '')
    .replace(/\[No speech detected\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function recordingUriToBase64(uri: string): Promise<string | null> {
  try {
    const file = new FSFile(uri);
    if (!file.exists) return null;
    return await file.base64();
  } catch {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const value = reader.result;
          if (typeof value === 'string') resolve(value);
          else reject(new Error('Unexpected reader result type'));
        };
        reader.onerror = () => reject(new Error('Failed reading recording blob'));
        reader.readAsDataURL(blob);
      });
      return dataUrl.split(',')[1] || null;
    } catch {
      return null;
    }
  }
}

const CALL_PROBLEM = 'Something went wrong with the call. Please try again.';
/** How long a passing call notice (e.g. "reconnecting") stays on screen */
const CALL_NOTICE_MS = 6000;

/** Width the camera snapshot is scaled down to before it goes to the AI with each message */
const SNAPSHOT_MAX_WIDTH = 640;

/**
 * Full-resolution phone photos are several MB as base64 and slow down every reply
 * (upload + model processing); 640px wide is plenty for the AI to recognise parts.
 */
async function shrinkSnapshot(uri: string, width?: number): Promise<string | null> {
  try {
    const context = ImageManipulator.manipulate(uri);
    if (!width || width > SNAPSHOT_MAX_WIDTH) context.resize({ width: SNAPSHOT_MAX_WIDTH });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
    if (result.base64) return result.base64;
  } catch {
    // Fall back to the unresized photo below.
  }
  return recordingUriToBase64(uri);
}

interface VideoCallScreenProps {
  onEndCall: () => void;
  /** Seed context when continuing from a saved video call summary */
  priorConversationSummary?: string;
  /** Prefer vehicle from saved history when continuing */
  vehicleIdOverride?: string;
}

interface LiveMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  /** How a user message was sent; shown as a small mic icon for voice */
  source?: 'voice' | 'text';
}

/** Messages kept visible over the camera while the chat is collapsed (newest last) */
const COLLAPSED_MESSAGE_COUNT = 3;
/** Opacity by distance from the newest item, so older lines fade out */
const COLLAPSED_OPACITY = [1, 0.75, 0.45];

const QUICK_QUESTIONS = [
  { label: 'What is this?', question: 'What am I looking at here, and does anything look wrong?' },
  { label: 'Is it safe to drive?', question: 'Is it safe to keep driving with this problem?' },
  { label: 'Cost estimate?', question: 'Roughly how much would it cost to fix this?' },
  { label: 'Need a mechanic?', question: 'Can I fix this myself, or do I need a mechanic?' },
] as const;

function formatCallDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function extractTranscriptReplyJson(
  text: string
): { transcript?: string; reply?: string } | null {
  const trimmed = text.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(),
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { transcript?: string; reply?: string };
      if (typeof parsed.transcript === 'string' || typeof parsed.reply === 'string') return parsed;
    } catch {
      // ignore
    }
    const match = candidate.match(/\{[\s\S]*\}/);
    if (!match) continue;
    try {
      const parsed = JSON.parse(match[0]) as { transcript?: string; reply?: string };
      if (typeof parsed.transcript === 'string' || typeof parsed.reply === 'string') return parsed;
    } catch {
      // ignore
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export const VideoCallScreen: React.FC<VideoCallScreenProps> = ({
  onEndCall,
  priorConversationSummary,
  vehicleIdOverride,
}) => {
  const { spacing, fontSizes, scale, borderRadius } = useResponsive();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<
    'calling' | 'connecting' | 'connected' | 'error' | 'ended'
  >('calling');
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [, setTurnState] = useState<'user_speaking' | 'ai_speaking' | 'idle'>('idle');
  const [liveCaption, setLiveCaption] = useState('');
  const [waitingForReply, setWaitingForReply] = useState(false);
  const [audioSentCount, setAudioSentCount] = useState(0);
  const [lastAudioMeta, setLastAudioMeta] = useState<string>('');
  const [aiMuted, setAiMuted] = useState(false);
  const [chatHidden, setChatHidden] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const aiMutedRef = useRef(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const wave1 = useRef(new Animated.Value(0.3)).current;
  const wave2 = useRef(new Animated.Value(0.3)).current;
  const wave3 = useRef(new Animated.Value(0.3)).current;
  const wave4 = useRef(new Animated.Value(0.3)).current;
  const wave5 = useRef(new Animated.Value(0.3)).current;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const chatListRef = useRef<FlatList>(null);
  const sessionIdRef = useRef<string>(`ai-call-${Date.now()}`);
  const sendRef = useRef<null | ((text: string) => Promise<void>)>(null);
  const sendAudioChunkRef = useRef<null | ((audioBase64: string, mimeType?: string) => Promise<void>)>(
    null
  );
  const sendVideoFrameRef = useRef<null | ((frameBase64: string, mimeType?: string) => Promise<void>)>(
    null
  );
  const stopRef = useRef<null | (() => Promise<void>)>(null);
  const recordingUriRef = useRef<string | null>(null);
  const recorder = useAudioRecorder(RECORDING_OPTIONS, (status) => {
    if (status.isFinished && status.url) {
      recordingUriRef.current = status.url;
    }
  });
  const recorderReadyRef = useRef(false);
  const activelyRecordingRef = useRef(false);
  const recordingBusyRef = useRef(false);
  const pendingStopAfterStartRef = useRef(false);
  const isHoldingMicRef = useRef(false);
  const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCaptionRef = useRef('');
  const lastSnapshotAtRef = useRef(0);
  const microphoneGrantedRef = useRef(false);
  const lastAgentAudioAtRef = useRef(0);
  const speechAvailableRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const currentAiSoundRef = useRef<AudioPlayer | null>(null);
  const waitingForReplyRef = useRef(false);
  const { selectedVehicleId, vehicles, selectedVehicle } = useVehicles();
  const effectiveVehicleId =
    selectedVehicle?._id ??
    vehicles.find((v) => v._id === selectedVehicleId)?._id ??
    vehicles[0]?._id;
  const joinVehicleId = vehicleIdOverride ?? effectiveVehicleId;
  const toggleCamera = () => {
    setCameraFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const captureAndSendSnapshot = async (force = false) => {
    if (!sendVideoFrameRef.current || !cameraRef.current || !permission?.granted) return;
    const now = Date.now();
    if (!force && now - lastSnapshotAtRef.current < SNAPSHOT_MIN_INTERVAL_MS) return;
    try {
      const capture = await cameraRef.current?.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!capture?.uri) return;
      const frameBase64 = await shrinkSnapshot(capture.uri, capture.width);
      if (frameBase64 && sendVideoFrameRef.current) {
        await sendVideoFrameRef.current(frameBase64, 'image/jpeg');
        lastSnapshotAtRef.current = now;
      }
    } catch {
      // Visual context is best-effort.
    }
  };

  const preparingRef = useRef(false);
  const prepareFailCountRef = useRef(0);

  const setSpeakerOutputMode = async () => {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
      shouldRouteThroughEarpiece: false,
    });
  };

  const prepareRecorder = async () => {
    if (preparingRef.current || recorderReadyRef.current) return;
    if (prepareFailCountRef.current >= 5) return;
    preparingRef.current = true;
    try {
      if (!microphoneGrantedRef.current) {
        const perm = await requestRecordingPermissionsAsync();
        microphoneGrantedRef.current = perm.granted;
      }
      if (!microphoneGrantedRef.current) {
        preparingRef.current = false;
        return;
      }
      try { await recorder.stop().catch(() => {}); } catch {}
      await sleep(100);
      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      // Keep playback route active while idle; switch to recording mode only when user actually starts recording.
      await setSpeakerOutputMode();
      recorderReadyRef.current = true;
      prepareFailCountRef.current = 0;
    } catch (e) {
      recorderReadyRef.current = false;
      prepareFailCountRef.current++;
      if (prepareFailCountRef.current <= 2) {
        console.warn('[recorder] prepareRecorder failed (attempt ' + prepareFailCountRef.current + '):', e);
      }
    } finally {
      preparingRef.current = false;
    }
  };

  const recordingStartedAtRef = useRef(0);

  const startRecording = async (): Promise<boolean> => {
    if (
      status !== 'connected' ||
      !sendAudioChunkRef.current ||
      recordingBusyRef.current ||
      activelyRecordingRef.current
    ) {
      return false;
    }
    recordingBusyRef.current = true;
    try {
      if (!microphoneGrantedRef.current) {
        const perm = await requestRecordingPermissionsAsync();
        microphoneGrantedRef.current = perm.granted;
      }
      if (!microphoneGrantedRef.current) {
        setSessionError('Please allow microphone access in Settings to talk to the expert.');
        return false;
      }
      if (!recorderReadyRef.current) {
        prepareFailCountRef.current = 0;
        await prepareRecorder();
      }
      if (!recorderReadyRef.current) {
        setSessionError("The microphone couldn't start. Please end the call and try again.");
        return false;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });
      recordingUriRef.current = null;
      recorder.record();
      recordingStartedAtRef.current = Date.now();
      activelyRecordingRef.current = true;
      return true;
    } catch (error) {
      setSessionError(
        friendlyErrorMessage(error, "We couldn't start the microphone. Please hold the mic button again.")
      );
      return false;
    } finally {
      recordingBusyRef.current = false;
    }
  };

  const stopAndSendRecording = async () => {
    if (!activelyRecordingRef.current || !sendAudioChunkRef.current) return;
    activelyRecordingRef.current = false;
    const MIN_RECORDING_MS = 500;
    const elapsed = Date.now() - recordingStartedAtRef.current;
    if (elapsed < MIN_RECORDING_MS) {
      const remaining = MIN_RECORDING_MS - elapsed;
      await sleep(remaining);
    }
    try {
      recordingUriRef.current = null;
      recorderReadyRef.current = false;
      let uri: string | null = null;
      try {
        const stopResult = await (recorder.stop() as Promise<unknown>);
        if (typeof stopResult === 'string' && stopResult.length > 0) uri = stopResult;
      } catch {}
      try {
        await setSpeakerOutputMode();
        sendTonePlayer.seekTo(0);
        sendTonePlayer.play();
      } catch {}
      if (!uri) uri = recorder.uri || recordingUriRef.current;
      if (!uri) {
        await sleep(200);
        uri = recorder.uri || recordingUriRef.current;
      }
      if (!uri) {
        try {
          const st = recorder.getStatus();
          uri = st.url;
        } catch {}
      }
      if (!uri) {
        setWaitingForReply(false);
        waitingForReplyRef.current = false;
        setSessionError("We didn't catch that. Please hold the mic and try again.");
        void prepareRecorder();
        return;
      }
      const base64Audio = await recordingUriToBase64(uri);
      if (!base64Audio || base64Audio.length < 100 || !sendAudioChunkRef.current) {
        setWaitingForReply(false);
        waitingForReplyRef.current = false;
        setSessionError(
          !base64Audio || (base64Audio && base64Audio.length < 100)
            ? 'That was too short. Please hold the mic button while you speak.'
            : "We couldn't read your voice message. Please try again."
        );
        void prepareRecorder();
        return;
      }
      await captureAndSendSnapshot();
      setWaitingForReply(true);
      waitingForReplyRef.current = true;
      setAiState('thinking');
      await sendAudioChunkRef.current(base64Audio, AUDIO_MIME_TYPE);
      setAudioSentCount((prev) => prev + 1);
      setLastAudioMeta(`${AUDIO_MIME_TYPE} • ${Math.round(base64Audio.length / 1024)}KB`);
      // Do not prepare recorder immediately after send; it can force call-style routing.
      // Recorder is prepared again after AI playback completes.
    } catch (error) {
      setWaitingForReply(false);
      waitingForReplyRef.current = false;
      setSessionError(
        friendlyErrorMessage(error, "Your voice message didn't send. Please try again.")
      );
      void prepareRecorder();
    }
  };

  const handleMicPressInRef = useRef(() => {});
  const handleMicPressOutRef = useRef(() => {});

  handleMicPressInRef.current = () => {
    if (waitingForReplyRef.current || isAiSpeakingRef.current) return;
    setIsHoldingMic(true);
    isHoldingMicRef.current = true;
    pendingStopAfterStartRef.current = false;
    setSessionError(null);
    void Speech.stop();
    if (currentAiSoundRef.current) {
      try { currentAiSoundRef.current.remove(); } catch {}
      currentAiSoundRef.current = null;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void (async () => {
      const started = await startRecording();
      if (!started) {
        setIsHoldingMic(false);
      }
      if (pendingStopAfterStartRef.current) {
        pendingStopAfterStartRef.current = false;
        void stopAndSendRecording();
      }
    })();
  };

  handleMicPressOutRef.current = () => {
    if (!isHoldingMicRef.current && !activelyRecordingRef.current && !recordingBusyRef.current) {
      return;
    }
    setIsHoldingMic(false);
    isHoldingMicRef.current = false;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (recordingBusyRef.current) {
      pendingStopAfterStartRef.current = true;
      return;
    }
    void stopAndSendRecording();
  };

  const terminatedWhileHoldingRef = useRef(false);

  const micPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => isHoldingMicRef.current,
      onPanResponderGrant: () => {
        terminatedWhileHoldingRef.current = false;
        handleMicPressInRef.current();
      },
      onPanResponderRelease: () => {
        terminatedWhileHoldingRef.current = false;
        handleMicPressOutRef.current();
      },
      onPanResponderTerminate: () => {
        if (isHoldingMicRef.current) {
          terminatedWhileHoldingRef.current = true;
          return;
        }
        handleMicPressOutRef.current();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const handleTouchEnd = () => {
    if (terminatedWhileHoldingRef.current) {
      terminatedWhileHoldingRef.current = false;
      handleMicPressOutRef.current();
    }
  };

  const ringtonePlayer = useAudioPlayer(RINGTONE_SOURCE);
  const sendTonePlayer = useAudioPlayer(SEND_TONE_SOURCE);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        const perm = await requestRecordingPermissionsAsync();
        microphoneGrantedRef.current = perm.granted;
      } catch {}
      speechAvailableRef.current = true;
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

  const stopAiPlaybackImmediately = async () => {
    try {
      Speech.stop();
    } catch {
      // noop
    }
    const sound = currentAiSoundRef.current;
    currentAiSoundRef.current = null;
    if (sound) {
      try { sound.remove(); } catch {}
    }
    isAiSpeakingRef.current = false;
    setAiState('listening');
    void prepareRecorder();
  };

  const updateLiveCaptionSmooth = (text: string, final = false) => {
    const cleaned = normalizeAgentText(text);
    if (!cleaned) return;
    if (final) {
      if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
      captionTimerRef.current = null;
      pendingCaptionRef.current = '';
      setLiveCaption(cleaned);
      return;
    }
    pendingCaptionRef.current = cleaned;
    if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
    captionTimerRef.current = setTimeout(() => {
      setLiveCaption(pendingCaptionRef.current);
      captionTimerRef.current = null;
    }, CAPTION_SMOOTHING_MS);
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
    isAiSpeakingRef.current = aiState === 'speaking';
  }, [aiState]);

  useEffect(() => {
    let active = true;
    setStatus('connecting');
    setSessionError(null);
    sessionIdRef.current = `ai-call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    (async () => {
      try {
        const sessionId = sessionIdRef.current;
        const session = await joinLiveAiCall(sessionId, {
          onReady: () => {
            if (!active) return;
            setStatus('connected');
            setAiState('idle');
          },
          onUserText: (text) => {
            if (!active) return;
            const cleaned = text.trim();
            if (!cleaned) return;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'user') {
                const updateLikelySameUtterance =
                  cleaned.startsWith(last.content) || last.content.startsWith(cleaned);
                if (updateLikelySameUtterance) {
                  return [...prev.slice(0, -1), { ...last, content: cleaned }];
                }
              }
              return [
                ...prev,
                { id: `${Date.now()}-${Math.random()}`, role: 'user', content: cleaned, source: 'voice' },
              ];
            });
            setAiState('thinking');
          },
          onAgentText: (text) => {
            if (!active) return;
            const maybeStructured = extractTranscriptReplyJson(text);
            const transcriptFromPayload = maybeStructured?.transcript?.trim() || '';
            const replyFromPayload = maybeStructured?.reply?.trim() || '';
            if (transcriptFromPayload) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'user') {
                  const likelySame =
                    transcriptFromPayload.startsWith(last.content) ||
                    last.content.startsWith(transcriptFromPayload);
                  if (likelySame) {
                    return [...prev.slice(0, -1), { ...last, content: transcriptFromPayload }];
                  }
                }
                return [
                  ...prev,
                  {
                    id: `${Date.now()}-${Math.random()}`,
                    role: 'user',
                    content: transcriptFromPayload,
                    source: 'voice',
                  },
                ];
              });
            }
            const cleanedText = normalizeAgentText(replyFromPayload || text);
            if (!cleanedText || cleanedText.startsWith('{')) return;
            setWaitingForReply(false);
            waitingForReplyRef.current = false;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'model' && last.content === cleanedText) return prev;
              return [
                ...prev,
                { id: `${Date.now()}-${Math.random()}`, role: 'model', content: cleanedText },
              ];
            });
            setLiveCaption(cleanedText);
            const now = Date.now();
            const gotRecentModelAudio =
              now - lastAgentAudioAtRef.current < AGENT_AUDIO_PRIORITY_WINDOW_MS;
            if (
              !gotRecentModelAudio &&
              cleanedText.length > 0 &&
              speechAvailableRef.current &&
              !aiMutedRef.current
            ) {
              setAiState('speaking');
              void Speech.stop();
              void (async () => {
                try {
                  await setSpeakerOutputMode();
                } catch (e) {
                  console.warn('[audio] failed to switch to speaker mode before TTS:', e);
                }
                Speech.speak(cleanedText, {
                rate: 0.95,
                pitch: 1,
                onDone: () => {
                  setAiState('idle');
                  setTurnState('idle');
                },
                onStopped: () => {
                  setAiState('idle');
                  setTurnState('idle');
                },
                onError: () => {
                  setAiState('idle');
                  setTurnState('idle');
                },
                });
              })();
            } else if (!gotRecentModelAudio) {
              setAiState('idle');
              setTurnState('idle');
            }
          },
          onCaptionPartial: (text) => {
            if (!active) return;
            updateLiveCaptionSmooth(text, false);
          },
          onCaptionFinal: (text) => {
            if (!active) return;
            const cleaned = normalizeAgentText(text);
            if (!cleaned) return;
            setWaitingForReply(false);
            waitingForReplyRef.current = false;
            updateLiveCaptionSmooth(cleaned, true);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'model' && last.content === cleaned) return prev;
              return [
                ...prev,
                { id: `${Date.now()}-${Math.random()}`, role: 'model', content: cleaned },
              ];
            });
          },
          onAgentAudioChunk: (audioBase64, mimeType) => {
            if (!active || !audioBase64) return;
            lastAgentAudioAtRef.current = Date.now();
            setWaitingForReply(false);
            waitingForReplyRef.current = false;
            if (aiMutedRef.current) return;
            void (async () => {
              try {
                await Speech.stop();
                await setSpeakerOutputMode();
                if (currentAiSoundRef.current) {
                  currentAiSoundRef.current.remove();
                  currentAiSoundRef.current = null;
                }
                const ext = (mimeType || 'audio/mp4').includes('wav') ? 'wav' : 'mp4';
                const tmpFile = new FSFile(Paths.cache, `ai_audio_${Date.now()}.${ext}`);
                tmpFile.create({ overwrite: true });
                tmpFile.write(audioBase64, { encoding: 'base64' });
                const player = createAudioPlayer({ uri: tmpFile.uri });
                currentAiSoundRef.current = player;
                setAiState('speaking');
                player.play();
                const sub = player.addListener('playbackStatusUpdate', (status) => {
                  if (!status.playing && status.currentTime > 0) {
                    sub.remove();
                    player.remove();
                    if (currentAiSoundRef.current === player) {
                      currentAiSoundRef.current = null;
                    }
                    setAiState('idle');
                    setTurnState('idle');
                    try { tmpFile.delete(); } catch {}
                  }
                });
              } catch (e) {
                console.warn('[audio] streamed AI audio playback failed:', e);
              }
            })();
          },
          onListening: () => {
            if (!active) return;
            setAiState('listening');
          },
          onSpeaking: () => {
            if (!active) return;
            setAiState('speaking');
          },
          onTurnState: (stateName) => {
            if (!active) return;
            setTurnState(stateName);
            if (stateName === 'user_speaking') {
              void stopAiPlaybackImmediately();
            }
            if (stateName === 'idle') {
              setAiState('idle');
            }
          },
          onBargeIn: () => {
            if (!active) return;
            void stopAiPlaybackImmediately();
          },
          onAudioReceived: () => {
            // ack tracked internally
          },
          onError: (message, transient) => {
            if (!active) return;
            // The backend marks whether the call is still usable; older servers don't, so fall back to the text.
            const lowered = message.toLowerCase();
            const callStillUsable =
              transient ??
              (lowered.includes('reconnecting') ||
                lowered.includes('unstable') ||
                lowered.includes('busy'));
            if (!callStillUsable) setStatus('error');
            // Either way no reply is coming for the pending question, so stop the typing dots.
            setWaitingForReply(false);
            waitingForReplyRef.current = false;
            setSessionError(friendlyErrorMessage(message, CALL_PROBLEM));
            setAiState('idle');
          },
          onEnded: () => {
            if (!active) return;
            setStatus('ended');
            setAiState('idle');
          },
        }, {
          vehicleId: joinVehicleId,
          priorConversationSummary: priorConversationSummary?.trim() || undefined,
        });
        sendRef.current = session.sendText;
        sendAudioChunkRef.current = session.sendAudioChunk;
        sendVideoFrameRef.current = session.sendVideoFrame;
        stopRef.current = session.stop;
      } catch (e) {
        if (!active) return;
        setStatus('error');
        setSessionError(
          friendlyErrorMessage(e, "We couldn't connect the call. Please check your internet connection and try again.")
        );
      }
    })();

    return () => {
      active = false;
      void stopRef.current?.();
    };
  }, [joinVehicleId, priorConversationSummary]);

  const handleEndCall = () => {
    void Speech.stop();
    safePause();
    void stopRef.current?.();
    onEndCall();
  };

  const toggleAiMuted = () => {
    const next = !aiMutedRef.current;
    aiMutedRef.current = next;
    setAiMuted(next);
    if (next) {
      // Silence whatever the expert is saying right now; replies keep arriving as text.
      void Speech.stop();
      const sound = currentAiSoundRef.current;
      currentAiSoundRef.current = null;
      if (sound) {
        try { sound.remove(); } catch {}
      }
      isAiSpeakingRef.current = false;
      setAiState('idle');
    }
  };

  const handleSendQuestion = async (textOverride?: string) => {
    const cleaned = (textOverride ?? inputText).trim();
    if (!cleaned || !sendRef.current || isSending) return;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role: 'user', content: cleaned, source: 'text' },
    ]);
    if (textOverride === undefined) setInputText('');
    setIsSending(true);
    setSessionError(null);
    setAiState('thinking');
    setWaitingForReply(true);
    waitingForReplyRef.current = true;
    try {
      await captureAndSendSnapshot();
      await sendRef.current(cleaned);
    } catch (e) {
      setSessionError(friendlyErrorMessage(e, "Your message didn't send. Please try again."));
      setWaitingForReply(false);
      waitingForReplyRef.current = false;
      setAiState('idle');
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    requestPermission();
  }, []);

  useEffect(() => {
    if (!sessionError || status !== 'connected') return;
    const id = setTimeout(() => setSessionError(null), CALL_NOTICE_MS);
    return () => clearTimeout(id);
  }, [sessionError, status]);

  useEffect(() => {
    if (status !== 'connected') return;
    const id = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status !== 'connected') return;
    void captureAndSendSnapshot(true);
  }, [status, permission?.granted, cameraFacing]);

  useEffect(() => {
    if (!isHoldingMic) {
      ripple1.setValue(0);
      ripple2.setValue(0);
      ripple3.setValue(0);
      return;
    }
    const makeRipple = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const a1 = makeRipple(ripple1, 0);
    const a2 = makeRipple(ripple2, 400);
    const a3 = makeRipple(ripple3, 800);
    a1.start();
    a2.start();
    a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [isHoldingMic]);

  useEffect(() => {
    if (!waitingForReply) {
      dot1.setValue(0);
      dot2.setValue(0);
      dot3.setValue(0);
      return;
    }
    const makeBounce = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -10, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );
    const b1 = makeBounce(dot1, 0);
    const b2 = makeBounce(dot2, 150);
    const b3 = makeBounce(dot3, 300);
    b1.start();
    b2.start();
    b3.start();
    return () => { b1.stop(); b2.stop(); b3.stop(); };
  }, [waitingForReply]);

  useEffect(() => {
    const speaking = aiState === 'speaking';
    if (!speaking) {
      wave1.setValue(0.3);
      wave2.setValue(0.3);
      wave3.setValue(0.3);
      wave4.setValue(0.3);
      wave5.setValue(0.3);
      return;
    }
    const makeWave = (anim: Animated.Value, delay: number, peak: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: peak, duration: 250, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0.2, duration: 350, useNativeDriver: false }),
        ])
      );
    const w1 = makeWave(wave1, 0, 0.7);
    const w2 = makeWave(wave2, 80, 1);
    const w3 = makeWave(wave3, 160, 0.85);
    const w4 = makeWave(wave4, 240, 0.95);
    const w5 = makeWave(wave5, 320, 0.6);
    w1.start(); w2.start(); w3.start(); w4.start(); w5.start();
    return () => { w1.stop(); w2.stop(); w3.stop(); w4.stop(); w5.stop(); };
  }, [aiState]);

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

  useEffect(() => {
    return () => {
      if (activelyRecordingRef.current) {
        activelyRecordingRef.current = false;
        void recorder.stop().catch(() => {});
      }
      void Speech.stop();
      if (captionTimerRef.current) {
        clearTimeout(captionTimerRef.current);
        captionTimerRef.current = null;
      }
      if (currentAiSoundRef.current) {
        try { currentAiSoundRef.current.remove(); } catch {}
        currentAiSoundRef.current = null;
      }
    };
  }, []);

  const statusText =
    status === 'calling'
      ? 'Calling...'
      : status === 'connecting'
      ? 'Connecting...'
      : status === 'connected'
      ? isHoldingMic
        ? 'Listening to you...'
        : aiState === 'thinking' || waitingForReply
        ? 'Processing...'
        : aiState === 'speaking'
        ? 'Responding...'
        : 'Connected'
      : status === 'ended'
      ? 'Call ended'
      : 'Connection issue';

  const styles = useMemo(() => {
    const micSize = Math.round(scale(68));
    const micR = micSize / 2;
    const sideSize = Math.round(scale(52));
    const sideR = sideSize / 2;
    const roundBtn = 44;

    return StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: call.bg,
      },
      remoteVideo: {
        ...StyleSheet.absoluteFill,
        backgroundColor: call.cameraArea,
        overflow: 'hidden',
      },
      camera: {
        flex: 1,
      },
      remotePlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: scale(220),
      },
      avatarLarge: {
        width: scale(100),
        height: scale(100),
        borderRadius: scale(50),
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        ...shadows.lg,
      },
      remoteName: {
        fontSize: fontSizes.xl,
        fontWeight: '700',
        color: call.text,
        letterSpacing: 0.2,
      },
      enableCameraButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.lg,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        ...shadows.md,
      },

      // Top bar
      topBar: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
      },
      expertPill: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        backgroundColor: call.overlayPill,
        borderRadius: borderRadius.full,
        paddingVertical: 6,
        paddingLeft: 6,
        paddingRight: spacing.md,
      },
      expertAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
      },
      expertName: {
        color: call.text,
        fontSize: fontSizes.sm,
        fontWeight: '700',
      },
      statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 1,
      },
      statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginRight: 5,
      },
      statusLine: {
        color: call.textMuted,
        fontSize: fontSizes.xs,
        fontWeight: '500',
      },
      topActions: {
        flexDirection: 'row',
        marginLeft: spacing.sm,
      },
      roundButton: {
        width: roundBtn,
        height: roundBtn,
        borderRadius: roundBtn / 2,
        backgroundColor: call.overlayPill,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.sm,
      },
      roundButtonActive: {
        backgroundColor: call.micActiveBg,
      },

      // Messages floating over the camera
      bottomArea: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
      },
      messagesArea: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
      },
      expandedList: {
        maxHeight: scale(360),
        backgroundColor: call.panel,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.sm,
      },
      bubble: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        maxWidth: '84%',
        paddingHorizontal: 13,
        paddingVertical: 9,
        marginTop: spacing.sm,
        borderRadius: 18,
      },
      bubbleUser: {
        alignSelf: 'flex-end',
        backgroundColor: colors.primary,
        borderBottomRightRadius: 6,
      },
      bubbleAi: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(15,23,42,0.84)',
        borderBottomLeftRadius: 6,
      },
      bubbleText: {
        flexShrink: 1,
        color: call.text,
        fontSize: fontSizes.sm,
        lineHeight: Math.round(fontSizes.sm * 1.45),
        fontWeight: '500',
      },
      voiceIcon: {
        marginRight: 6,
        marginTop: 2,
      },
      typingBubble: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15,23,42,0.84)',
        borderRadius: 18,
        borderBottomLeftRadius: 6,
        paddingHorizontal: 16,
        paddingVertical: 13,
        marginTop: spacing.sm,
      },
      typingDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: call.textMuted,
        marginHorizontal: 2.5,
      },
      hintText: {
        alignSelf: 'center',
        color: call.text,
        fontSize: fontSizes.sm,
        fontWeight: '500',
        textAlign: 'center',
        backgroundColor: call.overlayPill,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      },
      historyToggle: {
        alignSelf: 'center',
        backgroundColor: call.overlayPill,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        marginBottom: spacing.xs,
      },
      historyToggleText: {
        color: call.text,
        fontSize: fontSizes.xs,
        fontWeight: '600',
      },
      errorText: {
        alignSelf: 'center',
        color: call.errorSoft,
        fontSize: fontSizes.xs,
        fontWeight: '600',
        textAlign: 'center',
        backgroundColor: call.overlayPill,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        marginBottom: spacing.xs,
      },

      // Bottom sheet: chips, input, call controls
      sheet: {
        backgroundColor: 'rgba(2,6,23,0.82)',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: spacing.md,
        paddingHorizontal: spacing.md,
      },
      chipsRow: {
        paddingBottom: spacing.sm + 4,
      },
      chip: {
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: call.borderStrong,
        justifyContent: 'center',
        marginRight: spacing.sm,
      },
      chipText: {
        color: call.text,
        fontSize: fontSizes.xs + 1,
        fontWeight: '500',
      },
      inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      inputWrapper: {
        flex: 1,
        borderRadius: borderRadius.full,
        backgroundColor: call.inputBg,
        borderWidth: 1,
        borderColor: call.border,
        minHeight: 46,
        justifyContent: 'center',
      },
      input: {
        backgroundColor: 'transparent',
        color: call.text,
        fontSize: fontSizes.sm + 1,
        paddingHorizontal: 18,
        paddingVertical: Platform.OS === 'ios' ? 13 : 10,
      },
      sendBtn: {
        marginLeft: spacing.sm,
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      },
      disabled: {
        opacity: 0.45,
      },
      controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: spacing.md,
      },
      sideButton: {
        width: sideSize,
        height: sideSize,
        borderRadius: sideR,
        backgroundColor: call.controlIdle,
        alignItems: 'center',
        justifyContent: 'center',
      },
      endCallButton: {
        width: sideSize,
        height: sideSize,
        borderRadius: sideR,
        backgroundColor: colors.error,
        alignItems: 'center',
        justifyContent: 'center',
      },
      holdMicButton: {
        width: micSize,
        height: micSize,
        borderRadius: micR,
        marginHorizontal: scale(36),
        borderWidth: 3,
        borderColor: 'rgba(147,197,253,0.6)',
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        ...shadows.lg,
      },
      holdMicButtonActive: {
        backgroundColor: call.micActiveBg,
        borderColor: call.micActiveBorder,
        transform: [{ scale: 1.08 }],
      },
      rippleContainer: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      },
      rippleRing: {
        position: 'absolute',
        width: micSize,
        height: micSize,
        borderRadius: micR,
        borderWidth: 2,
        borderColor: call.ripple,
      },
      micHint: {
        textAlign: 'center',
        color: call.textSubtle,
        fontSize: fontSizes.xs,
        fontWeight: '500',
        marginTop: spacing.xs,
      },
    });
  }, [spacing, fontSizes, scale, borderRadius]);

  const showCamera = permission?.granted;
  const isConnected = status === 'connected';
  const canSend = isConnected && !isSending;

  const statusDotColor = isConnected
    ? '#22C55E'
    : status === 'error' || status === 'ended'
    ? colors.error
    : '#F59E0B';
  const statusLine = isConnected ? `${statusText} · ${formatCallDuration(callSeconds)}` : statusText;

  const recentMessages = messages.slice(-COLLAPSED_MESSAGE_COUNT);
  const hiddenCount = messages.length - recentMessages.length;
  // The typing bubble counts as the newest line, so it pushes older messages further into the fade.
  const fadeOffset = waitingForReply ? 1 : 0;

  const renderBubble = (item: LiveMessage, opacity = 1, numberOfLines?: number) => {
    const isUser = item.role === 'user';
    return (
      <View
        key={item.id}
        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi, { opacity }]}
      >
        {isUser && item.source === 'voice' ? (
          <Icon name="mic" size={13} color="#DBEAFE" style={styles.voiceIcon} />
        ) : null}
        <Text style={styles.bubbleText} numberOfLines={numberOfLines}>
          {item.content}
        </Text>
      </View>
    );
  };

  const dotStyle = (anim: Animated.Value) => [
    styles.typingDot,
    { transform: [{ translateY: anim.interpolate({ inputRange: [-10, 0], outputRange: [-4, 0] }) }] },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.remoteVideo}>
        {showCamera ? (
          <CameraView ref={cameraRef} style={styles.camera} facing={cameraFacing} />
        ) : (
          <View style={styles.remotePlaceholder}>
            <Animated.View
              style={[
                styles.avatarLarge,
                { transform: [{ scale: status === 'calling' ? pulseAnim : 1 }] },
              ]}
            >
              <Icon name="sparkles" size={scale(46)} color={call.text} />
            </Animated.View>
            <Text style={styles.remoteName}>Vehicle Expert</Text>
            {!permission?.granted && (
              <TouchableOpacity
                style={styles.enableCameraButton}
                onPress={requestPermission}
                activeOpacity={0.8}
              >
                <Icon name="camera" size={24} color={call.text} />
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

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <View style={styles.expertPill}>
          <View style={styles.expertAvatar}>
            <Icon name="sparkles" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.expertName} numberOfLines={1}>
              Vehicle Expert
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
              <Text style={styles.statusLine} numberOfLines={1}>
                {statusLine}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity
            style={[styles.roundButton, aiMuted && styles.roundButtonActive]}
            onPress={toggleAiMuted}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={aiMuted ? 'Unmute expert voice' : 'Mute expert voice'}
          >
            <Icon name={aiMuted ? 'volume-mute' : 'volume-high'} size={20} color={call.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roundButton, chatHidden && styles.roundButtonActive]}
            onPress={() => setChatHidden((v) => !v)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={chatHidden ? 'Show chat' : 'Hide chat'}
          >
            <Icon name={chatHidden ? 'eye-off' : 'chatbubble'} size={19} color={call.text} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomArea}
        pointerEvents="box-none"
      >
        {!chatHidden ? (
          <View style={styles.messagesArea} pointerEvents="box-none">
            {sessionError ? (
              <Text style={styles.errorText} numberOfLines={2}>
                {sessionError}
              </Text>
            ) : null}

            {hiddenCount > 0 || chatExpanded ? (
              <TouchableOpacity
                style={styles.historyToggle}
                onPress={() => setChatExpanded((v) => !v)}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={styles.historyToggleText}>
                  {chatExpanded ? 'Show less' : `Show full chat · ${messages.length}`}
                </Text>
              </TouchableOpacity>
            ) : null}

            {chatExpanded ? (
              <FlatList
                ref={chatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                style={styles.expandedList}
                contentContainerStyle={{ paddingBottom: spacing.sm }}
                onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
                renderItem={({ item }) => renderBubble(item)}
              />
            ) : (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => hiddenCount > 0 && setChatExpanded(true)}
                accessibilityLabel="Recent messages"
              >
                {recentMessages.map((item, i) => {
                  const fromNewest = recentMessages.length - 1 - i + fadeOffset;
                  const opacity = COLLAPSED_OPACITY[fromNewest] ?? 0.3;
                  // Older lines are clipped so the camera stays visible; the newest is shown in full.
                  return renderBubble(item, opacity, fromNewest === 0 ? 8 : 2);
                })}
              </TouchableOpacity>
            )}

            {waitingForReply ? (
              <View style={styles.typingBubble} accessibilityLabel="Expert is typing">
                <Animated.View style={dotStyle(dot1)} />
                <Animated.View style={dotStyle(dot2)} />
                <Animated.View style={dotStyle(dot3)} />
              </View>
            ) : null}

            {messages.length === 0 && !waitingForReply && isConnected ? (
              <Text style={styles.hintText}>Point the camera at the problem, then ask away.</Text>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipsRow}
          >
            {QUICK_QUESTIONS.map((q) => (
              <TouchableOpacity
                key={q.label}
                style={[styles.chip, !canSend && styles.disabled]}
                disabled={!canSend}
                onPress={() => void handleSendQuestion(q.question)}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={styles.chipText}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <View style={styles.inputWrapper} collapsable={false}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                editable={canSend}
                placeholder="Ask about what you see…"
                placeholderTextColor={call.textSubtle}
                selectionColor={colors.primary}
                cursorColor={call.text}
                keyboardAppearance="dark"
                underlineColorAndroid="transparent"
                maxLength={1000}
                returnKeyType="send"
                onSubmitEditing={() => void handleSendQuestion()}
                autoCorrect
                spellCheck={false}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                accessibilityLabel="Ask the expert"
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || !canSend) && styles.disabled]}
              disabled={!inputText.trim() || !canSend}
              onPress={() => void handleSendQuestion()}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Icon name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.sideButton, !showCamera && styles.disabled]}
              onPress={toggleCamera}
              activeOpacity={0.7}
              disabled={!showCamera}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
            >
              <Icon name="camera-reverse" size={22} color={call.text} />
            </TouchableOpacity>

            <View
              style={[
                styles.holdMicButton,
                isHoldingMic && styles.holdMicButtonActive,
                waitingForReply && { opacity: 0.5 },
              ]}
              {...micPanResponder.panHandlers}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Hold to talk"
            >
              <View pointerEvents="none" style={styles.rippleContainer}>
                {[ripple1, ripple2, ripple3].map((r, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.rippleRing,
                      {
                        transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
                        opacity: isHoldingMic
                          ? r.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })
                          : 0,
                      },
                    ]}
                  />
                ))}
              </View>
              <Icon name="mic" size={28} color="#FFFFFF" />
            </View>

            <TouchableOpacity
              style={styles.endCallButton}
              onPress={handleEndCall}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="End call"
            >
              <Icon name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.micHint}>{isHoldingMic ? 'Release to send' : 'Hold the mic to talk'}</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};
