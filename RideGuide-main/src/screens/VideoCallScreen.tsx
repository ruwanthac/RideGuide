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
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { joinLiveAiCall } from '../backend/liveAiCallService';
import { useVehicles } from '../context/VehiclesContext';

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
  const { spacing, fontSizes, scale } = useResponsive();
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
        quality: 0.25,
        base64: true,
        skipProcessing: true,
        shutterSound: false,
      });
      if (capture?.base64 && sendVideoFrameRef.current) {
        await sendVideoFrameRef.current(capture.base64, 'image/jpeg');
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
        setSessionError('Microphone permission is required for voice uplink.');
        return false;
      }
      if (!recorderReadyRef.current) {
        prepareFailCountRef.current = 0;
        await prepareRecorder();
      }
      if (!recorderReadyRef.current) {
        setSessionError('Microphone recorder could not start. Please restart the call.');
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
        error instanceof Error
          ? error.message
          : 'Unable to start microphone recording. Try holding mic again.'
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
        setSessionError('Recording completed but no audio file was produced.');
        void prepareRecorder();
        return;
      }
      const base64Audio = await recordingUriToBase64(uri);
      if (!base64Audio || base64Audio.length < 100 || !sendAudioChunkRef.current) {
        setWaitingForReply(false);
        waitingForReplyRef.current = false;
        setSessionError(
          !base64Audio || (base64Audio && base64Audio.length < 100)
            ? 'Recording was too short. Hold the mic button longer.'
            : 'Failed to read recorded audio.'
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
        error instanceof Error ? error.message : 'Unable to stop/send microphone recording.'
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
                { id: `${Date.now()}-${Math.random()}`, role: 'user', content: cleaned },
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
            if (!gotRecentModelAudio && cleanedText.length > 0 && speechAvailableRef.current) {
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
          onError: (message) => {
            if (!active) return;
            const lowered = message.toLowerCase();
            const isLiveStreamIssue =
              lowered.includes('live voice session') ||
              lowered.includes('live audio stream') ||
              lowered.includes('unable to stream audio') ||
              lowered.includes('gemini live') ||
              lowered.includes('reconnecting') ||
              lowered.includes('socket disconnected') ||
              lowered.includes('tls connection') ||
              lowered.includes('epipe') ||
              lowered.includes('fetch failed') ||
              lowered.includes('network is unstable');
            if (!isLiveStreamIssue) {
              setStatus('error');
              setWaitingForReply(false);
              waitingForReplyRef.current = false;
            }
            setSessionError(message);
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
  }, [joinVehicleId, priorConversationSummary]);

  const handleEndCall = () => {
    void Speech.stop();
    safePause();
    void stopRef.current?.();
    onEndCall();
  };

  const handleSendQuestion = async () => {
    const cleaned = inputText.trim();
    if (!cleaned || !sendRef.current || isSending) return;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role: 'user', content: cleaned },
    ]);
    setInputText('');
    setIsSending(true);
    setSessionError(null);
    setAiState('thinking');
    setWaitingForReply(true);
    waitingForReplyRef.current = true;
    try {
      await captureAndSendSnapshot();
      await sendRef.current(cleaned);
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : 'Failed to send question.');
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
      ? 'Connecting to AI...'
      : status === 'connected'
      ? isHoldingMic
        ? 'Listening to you...'
        : aiState === 'thinking' || waitingForReply
        ? 'Processing...'
        : aiState === 'speaking'
        ? 'AI is responding...'
        : 'Connected to AI'
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
          zIndex: 20,
          elevation: 20,
        },
        controlButton: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: 'rgba(255,255,255,0.2)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        holdMicButton: {
          width: 82,
          height: 82,
          borderRadius: 41,
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.32)',
          backgroundColor: 'rgba(15,23,42,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        },
        holdMicButtonActive: {
          backgroundColor: 'rgba(37,99,235,0.85)',
          borderColor: 'rgba(191,219,254,0.95)',
        },
        rippleContainer: {
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        },
        rippleRing: {
          position: 'absolute',
          width: 82,
          height: 82,
          borderRadius: 41,
          borderWidth: 2,
          borderColor: 'rgba(96,165,250,0.6)',
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
          maxHeight: scale(280),
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderRadius: 16,
          padding: spacing.sm,
          zIndex: 5,
          elevation: 5,
        },
        chatList: {
          flex: 1,
          marginBottom: spacing.xs,
        },
        holdHintText: {
          color: 'rgba(255,255,255,0.8)',
          fontSize: fontSizes.xs,
          marginBottom: spacing.xs,
        },
        holdHintActive: {
          color: '#BFDBFE',
        },
        chatBubble: {
          marginBottom: spacing.xs,
          maxWidth: '80%',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs + 2,
          borderRadius: 14,
        },
        chatBubbleUser: {
          alignSelf: 'flex-end',
          backgroundColor: 'rgba(37,99,235,0.7)',
          borderBottomRightRadius: 4,
        },
        chatBubbleAi: {
          alignSelf: 'flex-start',
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderBottomLeftRadius: 4,
        },
        chatBubbleLabel: {
          color: 'rgba(255,255,255,0.6)',
          fontSize: fontSizes.xs - 1,
          marginBottom: 2,
          fontWeight: '600',
        },
        chatBubbleText: {
          color: '#FFFFFF',
          fontSize: fontSizes.sm,
          lineHeight: fontSizes.sm * 1.4,
        },
        chatEmptyText: {
          color: 'rgba(255,255,255,0.5)',
          fontSize: fontSizes.sm,
          textAlign: 'center',
          paddingVertical: spacing.lg,
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
          <CameraView ref={cameraRef} style={styles.camera} facing={cameraFacing} />
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? scale(24) : 0}
        style={styles.chatPanel}
      >
        {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
        <FlatList
          ref={chatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.chatList}
          onContentSizeChange={() =>
            chatListRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.chatBubble,
                item.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAi,
              ]}
            >
              <Text style={styles.chatBubbleLabel}>
                {item.role === 'user' ? 'You' : 'AI'}
              </Text>
              <Text style={styles.chatBubbleText}>{item.content}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.chatEmptyText}>
              Hold the mic button and speak to start...
            </Text>
          }
        />
        <Text style={[styles.holdHintText, isHoldingMic && styles.holdHintActive]}>
          {isHoldingMic
            ? 'Listening... release to send'
            : waitingForReply
            ? 'Processing your voice...'
            : aiState === 'speaking'
            ? 'AI is responding...'
            : 'Hold mic button to speak'}
        </Text>
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            value={inputText}
            onChangeText={setInputText}
            editable={status === 'connected' && !isSending}
            placeholder="Type a message..."
            placeholderTextColor="rgba(255,255,255,0.5)"
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

      <View style={styles.controls}>
        <View
          style={[
            styles.holdMicButton,
            { marginRight: spacing.xl },
            isHoldingMic && styles.holdMicButtonActive,
            waitingForReply && { opacity: 0.5 },
          ]}
          {...micPanResponder.panHandlers}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <View pointerEvents="none" style={styles.rippleContainer}>
            <Animated.View
              style={[
                styles.rippleRing,
                {
                  transform: [{ scale: ripple1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
                  opacity: isHoldingMic
                    ? ripple1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })
                    : 0,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.rippleRing,
                {
                  transform: [{ scale: ripple2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
                  opacity: isHoldingMic
                    ? ripple2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })
                    : 0,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.rippleRing,
                {
                  transform: [{ scale: ripple3.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
                  opacity: isHoldingMic
                    ? ripple3.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })
                    : 0,
                },
              ]}
            />
          </View>
          <Icon name="mic" size={30} color="#FFFFFF" />
        </View>
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
    </View>
  );
};
