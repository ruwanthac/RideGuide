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
import { Audio } from 'expo-av';
import { useAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { joinLiveAiCall } from '../backend/liveAiCallService';
import { useVehicles } from '../context/VehiclesContext';
import { startPcmCapture, type PcmCaptureController } from '../native/pcmCapture';

const RINGTONE_SOURCE = require('../../assets/call.mp3');
const AUDIO_MIME_TYPE = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
const AGENT_AUDIO_PRIORITY_WINDOW_MS = 1200;
const SNAPSHOT_MIN_INTERVAL_MS = 1500;
const AUTO_CAPTURE_WINDOW_MS = 700;
const AUTO_CAPTURE_GAP_MS = 60;
const CAPTION_SMOOTHING_MS = 120;

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
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
    const raw = dataUrl.split(',')[1] || null;
    if (!raw) return null;
    return raw.replace(/^data:[^;]+;base64,/, '');
  } catch {
    return null;
  }
}

interface VideoCallScreenProps {
  onEndCall: () => void;
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

export const VideoCallScreen: React.FC<VideoCallScreenProps> = ({ onEndCall }) => {
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
  const [turnState, setTurnState] = useState<'user_speaking' | 'ai_speaking' | 'idle'>('idle');
  const [liveCaption, setLiveCaption] = useState('');
  const [captureMode, setCaptureMode] = useState<'pcm_streaming' | 'chunk_fallback'>(
    'chunk_fallback'
  );
  const [sessionReady, setSessionReady] = useState(false);
  const [audioSentCount, setAudioSentCount] = useState(0);
  const [audioAckCount, setAudioAckCount] = useState(0);
  const [lastAudioMeta, setLastAudioMeta] = useState<string>('');
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const sessionIdRef = useRef<string>(`ai-call-${Date.now()}`);
  const sendRef = useRef<null | ((text: string) => Promise<void>)>(null);
  const sendAudioChunkRef = useRef<null | ((audioBase64: string, mimeType?: string) => Promise<void>)>(
    null
  );
  const sendAudioFrameRef = useRef<
    | null
    | ((
        frameBase64: string,
        sampleRate?: number,
        channels?: number,
        sequence?: number,
        timestamp?: number
      ) => Promise<void>)
  >(null);
  const sendVideoFrameRef = useRef<null | ((frameBase64: string, mimeType?: string) => Promise<void>)>(
    null
  );
  const stopRef = useRef<null | (() => Promise<void>)>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingBusyRef = useRef(false);
  const pendingStopAfterStartRef = useRef(false);
  const isHoldingMicRef = useRef(false);
  const autoCaptureRunningRef = useRef(false);
  const autoCaptureCancelRef = useRef(false);
  const recordingModeRef = useRef<'auto' | 'manual' | null>(null);
  const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCaptionRef = useRef('');
  const lastSnapshotAtRef = useRef(0);
  const microphoneGrantedRef = useRef(false);
  const lastAgentAudioAtRef = useRef(0);
  const speechAvailableRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const currentAiSoundRef = useRef<Audio.Sound | null>(null);
  const pcmControllerRef = useRef<PcmCaptureController | null>(null);
  const pcmConsecutiveFailsRef = useRef(0);
  const { selectedVehicleId } = useVehicles();
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
      });
      if (capture?.base64 && sendVideoFrameRef.current) {
        await sendVideoFrameRef.current(capture.base64, 'image/jpeg');
        lastSnapshotAtRef.current = now;
      }
    } catch {
      // Visual context is best-effort.
    }
  };

  const startRecording = async (mode: 'auto' | 'manual'): Promise<boolean> => {
    if (
      status !== 'connected' ||
      !sendAudioChunkRef.current ||
      recordingBusyRef.current ||
      recordingRef.current
    ) {
      return false;
    }
    recordingBusyRef.current = true;
    try {
      if (!microphoneGrantedRef.current) {
        const micPermission = await Audio.requestPermissionsAsync();
        microphoneGrantedRef.current = micPermission.granted;
      }
      if (!microphoneGrantedRef.current) {
        setSessionError('Microphone permission is required for voice uplink.');
        return false;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: false,
      });
      try {
        const created = await Audio.Recording.createAsync(RECORDING_OPTIONS);
        recordingRef.current = created.recording;
        recordingModeRef.current = mode;
      } catch {
        // Some physical devices intermittently fail prepare on first try.
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: 1,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1,
          playThroughEarpieceAndroid: false,
        });
        await sleep(80);
        const createdRetry = await Audio.Recording.createAsync(RECORDING_OPTIONS);
        recordingRef.current = createdRetry.recording;
        recordingModeRef.current = mode;
      }
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

  const stopAndSendRecording = async (options?: { includeSnapshot?: boolean }) => {
    const includeSnapshot = options?.includeSnapshot ?? true;
    const recording = recordingRef.current;
    if (!recording || !sendAudioChunkRef.current) return;
    recordingRef.current = null;
    recordingModeRef.current = null;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) return;
      const base64Audio = await recordingUriToBase64(uri);
      if (!base64Audio || !sendAudioChunkRef.current) return;
      if (includeSnapshot) {
        await captureAndSendSnapshot();
      }
      await sendAudioChunkRef.current(base64Audio, AUDIO_MIME_TYPE);
      setAudioSentCount((prev) => prev + 1);
      setLastAudioMeta(`${AUDIO_MIME_TYPE} • ${Math.round(base64Audio.length / 1024)}KB`);
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : 'Unable to stop/send microphone recording.'
      );
    }
  };

  const handleMicPressIn = () => {
    if (captureMode === 'pcm_streaming') {
      // Streaming mode is always-on; keep button harmless.
      return;
    }
    setIsHoldingMic(true);
    isHoldingMicRef.current = true;
    pendingStopAfterStartRef.current = false;
    setSessionError(null);
    void Speech.stop();
    if (currentAiSoundRef.current) {
      void currentAiSoundRef.current.stopAsync().catch(() => {});
      void currentAiSoundRef.current.unloadAsync().catch(() => {});
      currentAiSoundRef.current = null;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // haptics unavailable on some devices
    });
    void (async () => {
      // If auto loop already started recording, let manual hold own it.
      if (recordingRef.current && recordingModeRef.current === 'auto') {
        recordingModeRef.current = 'manual';
        return;
      }
      const started = await startRecording('manual');
      if (!started) {
        setIsHoldingMic(false);
      }
      if (pendingStopAfterStartRef.current) {
        pendingStopAfterStartRef.current = false;
        void stopAndSendRecording({ includeSnapshot: true });
      }
    })();
  };

  const handleMicPressOut = () => {
    if (captureMode === 'pcm_streaming') return;
    if (!isHoldingMicRef.current && !recordingRef.current && !recordingBusyRef.current) {
      return;
    }
    setIsHoldingMic(false);
    isHoldingMicRef.current = false;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // haptics unavailable on some devices
    });
    if (recordingBusyRef.current) {
      pendingStopAfterStartRef.current = true;
      return;
    }
    void stopAndSendRecording({ includeSnapshot: true });
  };

  const micPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => isHoldingMicRef.current,
      onPanResponderGrant: () => {
        handleMicPressIn();
      },
      onPanResponderRelease: () => {
        handleMicPressOut();
      },
      onPanResponderTerminate: () => {
        handleMicPressOut();
      },
      onPanResponderTerminationRequest: () => !isHoldingMicRef.current,
    })
  ).current;

  const ringtonePlayer = useAudioPlayer(RINGTONE_SOURCE);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: 1,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        setSessionError(
          error instanceof Error ? error.message : 'Failed to initialize audio recording mode.'
        );
      }
      try {
        const micPermission = await Audio.requestPermissionsAsync();
        microphoneGrantedRef.current = micPermission.granted;
      } catch {
        microphoneGrantedRef.current = false;
      }
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
      await sound.stopAsync().catch(() => {});
      await sound.unloadAsync().catch(() => {});
    }
    isAiSpeakingRef.current = false;
    setAiState('listening');
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
                  const likelySame = transcriptFromPayload.startsWith(last.content);
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
            const now = Date.now();
            const gotRecentModelAudio =
              now - lastAgentAudioAtRef.current < AGENT_AUDIO_PRIORITY_WINDOW_MS;
            if (!gotRecentModelAudio && cleanedText.length > 0 && speechAvailableRef.current) {
              setAiState('speaking');
              void Speech.stop();
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
            } else {
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
            updateLiveCaptionSmooth(cleaned, true);
            setMessages((prev) => [
              ...prev,
              { id: `${Date.now()}-${Math.random()}`, role: 'model', content: cleaned },
            ]);
          },
          onAgentAudioChunk: (audioBase64, mimeType) => {
            if (!active || !audioBase64) return;
            lastAgentAudioAtRef.current = Date.now();
            void (async () => {
              try {
                await Speech.stop();
                if (currentAiSoundRef.current) {
                  await currentAiSoundRef.current.stopAsync().catch(() => {});
                  await currentAiSoundRef.current.unloadAsync().catch(() => {});
                  currentAiSoundRef.current = null;
                }
                const { sound } = await Audio.Sound.createAsync({
                  uri: `data:${mimeType};base64,${audioBase64}`,
                });
                currentAiSoundRef.current = sound;
                setAiState('speaking');
                await sound.playAsync();
                sound.setOnPlaybackStatusUpdate((playbackStatus) => {
                  if (!playbackStatus.isLoaded || !playbackStatus.didJustFinish) return;
                  void sound.unloadAsync();
                  if (currentAiSoundRef.current === sound) {
                    currentAiSoundRef.current = null;
                  }
                  setAiState('idle');
                  setTurnState('idle');
                });
              } catch {
                // Audio playback support varies by platform and codec.
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
              if (recordingRef.current && recordingModeRef.current === 'auto') {
                recordingModeRef.current = 'manual';
              }
            }
            if (stateName === 'idle') {
              setAiState('idle');
            }
          },
          onBargeIn: () => {
            if (!active) return;
            void stopAiPlaybackImmediately();
          },
          onModeDowngrade: () => {
            if (!active) return;
            if (pcmControllerRef.current) {
              void pcmControllerRef.current.stop();
              pcmControllerRef.current = null;
            }
            setCaptureMode('chunk_fallback');
            setSessionError('Live voice session degraded. Switching to chunk fallback.');
          },
          onAudioReceived: ({ mimeType, size }) => {
            if (!active) return;
            setAudioAckCount((prev) => prev + 1);
            setLastAudioMeta(`${mimeType} • ${Math.round(size / 1024)}KB`);
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
          vehicleId: selectedVehicleId ?? undefined,
        });
        sendRef.current = session.sendText;
        sendAudioFrameRef.current = session.sendAudioFrame;
        sendAudioChunkRef.current = session.sendAudioChunk;
        sendVideoFrameRef.current = session.sendVideoFrame;
        stopRef.current = session.stop;
        setSessionReady(true);
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
      setSessionReady(false);
      void stopRef.current?.();
    };
  }, [selectedVehicleId]);

  const handleEndCall = () => {
    void Speech.stop();
    if (pcmControllerRef.current) {
      void pcmControllerRef.current.stop();
      pcmControllerRef.current = null;
    }
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
      setAiState('thinking');
      await captureAndSendSnapshot();
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
    if (status !== 'connected') return;
    void captureAndSendSnapshot(true);
  }, [status, permission?.granted, cameraFacing]);

  useEffect(() => {
    if (!sessionReady || status !== 'connected') return;
    if (!sendAudioFrameRef.current) return;
    let cancelled = false;
    pcmConsecutiveFailsRef.current = 0;
    const PCM_FAIL_THRESHOLD = 10;
    const startStreaming = async () => {
      try {
        const controller = await startPcmCapture(async (frame) => {
          if (cancelled || !sendAudioFrameRef.current) return;
          try {
            await sendAudioFrameRef.current(
              frame.dataBase64,
              frame.sampleRate,
              frame.channels,
              frame.sequence,
              frame.timestamp
            );
            pcmConsecutiveFailsRef.current = 0;
            setAudioSentCount((prev) => prev + 1);
            setLastAudioMeta(`audio/pcm;rate=${frame.sampleRate} • frame`);
          } catch {
            pcmConsecutiveFailsRef.current += 1;
            if (pcmConsecutiveFailsRef.current >= PCM_FAIL_THRESHOLD) {
              cancelled = true;
              if (pcmControllerRef.current) {
                void pcmControllerRef.current.stop();
                pcmControllerRef.current = null;
              }
              setCaptureMode('chunk_fallback');
              setSessionError('PCM streaming failed repeatedly. Switching to chunk fallback.');
            }
          }
        });
        if (cancelled) {
          await controller.stop();
          return;
        }
        pcmControllerRef.current = controller;
        setCaptureMode('pcm_streaming');
        setSessionError(null);
      } catch {
        setCaptureMode('chunk_fallback');
        setSessionError('PCM streaming unavailable on this build. Using chunk fallback mode.');
      }
    };
    void startStreaming();
    return () => {
      cancelled = true;
      if (pcmControllerRef.current) {
        void pcmControllerRef.current.stop();
        pcmControllerRef.current = null;
      }
    };
  }, [sessionReady, status]);

  useEffect(() => {
    if (status !== 'connected') return;
    if (captureMode !== 'chunk_fallback') return;
    autoCaptureCancelRef.current = false;
    if (autoCaptureRunningRef.current) return;
    autoCaptureRunningRef.current = true;
    const runAutoCapture = async () => {
      while (!autoCaptureCancelRef.current) {
        if (!isHoldingMicRef.current && !recordingRef.current && !isAiSpeakingRef.current) {
          const started = await startRecording('auto');
          if (started) {
            await sleep(AUTO_CAPTURE_WINDOW_MS);
            if (!isHoldingMicRef.current) {
              await stopAndSendRecording({ includeSnapshot: false });
              await sleep(AUTO_CAPTURE_GAP_MS);
            }
          }
        }
      }
      autoCaptureRunningRef.current = false;
    };
    void runAutoCapture();
    return () => {
      autoCaptureCancelRef.current = true;
    };
  }, [status, captureMode]);

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
      void recordingRef.current?.stopAndUnloadAsync().catch(() => {
        // Ignore cleanup errors on unmount.
      });
      recordingRef.current = null;
      void Speech.stop();
      if (pcmControllerRef.current) {
        void pcmControllerRef.current.stop();
        pcmControllerRef.current = null;
      }
      if (captionTimerRef.current) {
        clearTimeout(captionTimerRef.current);
        captionTimerRef.current = null;
      }
      if (currentAiSoundRef.current) {
        void currentAiSoundRef.current.stopAsync().catch(() => {});
        void currentAiSoundRef.current.unloadAsync().catch(() => {});
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
      ? aiState === 'listening'
        ? 'AI is listening...'
        : aiState === 'thinking'
        ? 'AI is thinking...'
        : aiState === 'speaking'
        ? 'AI is speaking...'
        : isHoldingMic
        ? 'Listening to you...'
        : turnState === 'user_speaking'
        ? 'You are speaking...'
        : turnState === 'ai_speaking'
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
        },
        holdMicButtonActive: {
          backgroundColor: 'rgba(37,99,235,0.85)',
          borderColor: 'rgba(191,219,254,0.95)',
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
        uplinkText: {
          color: 'rgba(255,255,255,0.75)',
          fontSize: fontSizes.xs,
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
        captionsLabel: {
          color: 'rgba(255,255,255,0.82)',
          fontSize: fontSizes.xs,
          marginBottom: spacing.xs,
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

      <View style={styles.controls}>
        <View
          style={[
            styles.holdMicButton,
            { marginRight: spacing.xl },
            isHoldingMic && styles.holdMicButtonActive,
          ]}
          {...micPanResponder.panHandlers}
        >
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? scale(24) : 0}
        style={styles.chatPanel}
      >
        {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
        <Text style={[styles.holdHintText, isHoldingMic && styles.holdHintActive]}>
          {captureMode === 'pcm_streaming'
            ? 'Realtime mic streaming enabled'
            : isHoldingMic
            ? 'Listening... release to send'
            : 'Hold mic button while speaking'}
        </Text>
        <Text style={styles.uplinkText}>
          Voice uplink ({captureMode === 'pcm_streaming' ? 'PCM stream' : 'chunk fallback'}):{' '}
          {audioSentCount > 0
            ? `sent ${audioSentCount}, ack ${audioAckCount} (${lastAudioMeta})`
            : 'waiting...'}
        </Text>
        <Text style={styles.captionsLabel}>AI live captions</Text>
        <View style={styles.chatRow}>
          <Text style={styles.chatText}>{liveCaption || 'Waiting for AI response...'}</Text>
        </View>
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
