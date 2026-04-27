import { getSocket } from './socketClient';

export type LiveAiStatus = 'calling' | 'connecting' | 'connected' | 'error' | 'ended';

export interface LiveAiCallbacks {
  onReady?: () => void;
  onAgentText?: (text: string) => void;
  onUserText?: (text: string) => void;
  onCaptionPartial?: (text: string) => void;
  onCaptionFinal?: (text: string) => void;
  onAgentAudioChunk?: (audioBase64: string, mimeType: string) => void;
  onTurnState?: (state: 'user_speaking' | 'ai_speaking' | 'idle') => void;
  onBargeIn?: () => void;
  onModeDowngrade?: () => void;
  onListening?: () => void;
  onSpeaking?: () => void;
  onAudioReceived?: (meta: { mimeType: string; size: number; at: number }) => void;
  onError?: (message: string) => void;
  onEnded?: () => void;
}

export async function joinLiveAiCall(
  sessionId: string,
  callbacks: LiveAiCallbacks,
  options?: { vehicleId?: string }
): Promise<{
  sendText: (text: string) => Promise<void>;
  sendAudioFrame: (
    frameBase64: string,
    sampleRate?: number,
    channels?: number,
    sequence?: number,
    timestamp?: number
  ) => Promise<void>;
  sendAudioChunk: (audioBase64: string, mimeType?: string) => Promise<void>;
  sendVideoFrame: (frameBase64: string, mimeType?: string) => Promise<void>;
  stop: () => Promise<void>;
}> {
  const socket = await getSocket();
  const START_TIMEOUT_MS = 12000;

  const ensureConnected = () =>
    new Promise<void>((resolve, reject) => {
      if (socket.connected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Could not connect to server. Check backend and network.'));
      }, START_TIMEOUT_MS);

      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onConnectError = (err: Error) => {
        cleanup();
        reject(new Error(err?.message || 'Socket authentication failed'));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off('connect', onConnect);
        socket.off('connect_error', onConnectError);
      };

      socket.on('connect', onConnect);
      socket.on('connect_error', onConnectError);
    });

  const onReady = ({ sessionId: incoming }: { sessionId: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onReady?.();
  };
  const onAgentText = ({ sessionId: incoming, text }: { sessionId: string; text: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onAgentText?.(text);
  };
  const onUserText = ({ sessionId: incoming, text }: { sessionId: string; text: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onUserText?.(text);
  };
  const onCaptionPartial = ({ sessionId: incoming, text }: { sessionId: string; text: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onCaptionPartial?.(text);
  };
  const onCaptionFinal = ({ sessionId: incoming, text }: { sessionId: string; text: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onCaptionFinal?.(text);
  };
  const onTurnState = ({
    sessionId: incoming,
    state,
  }: {
    sessionId: string;
    state: 'user_speaking' | 'ai_speaking' | 'idle';
  }) => {
    if (incoming !== sessionId) return;
    callbacks.onTurnState?.(state);
  };
  const onBargeIn = ({ sessionId: incoming }: { sessionId: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onBargeIn?.();
  };
  const onAgentAudioChunk = ({
    sessionId: incoming,
    audioBase64,
    mimeType,
  }: {
    sessionId: string;
    audioBase64: string;
    mimeType: string;
  }) => {
    if (incoming !== sessionId) return;
    callbacks.onAgentAudioChunk?.(audioBase64, mimeType);
  };
  const onListening = ({ sessionId: incoming }: { sessionId: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onListening?.();
  };
  const onSpeaking = ({ sessionId: incoming }: { sessionId: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onSpeaking?.();
  };
  const onError = ({
    sessionId: incoming,
    message,
  }: {
    sessionId: string;
    message: string;
  }) => {
    if (incoming !== sessionId) return;
    callbacks.onError?.(message);
  };
  const onAudioReceived = ({
    sessionId: incoming,
    mimeType,
    size,
    at,
  }: {
    sessionId: string;
    mimeType: string;
    size: number;
    at: number;
  }) => {
    if (incoming !== sessionId) return;
    callbacks.onAudioReceived?.({ mimeType, size, at });
  };
  const onModeDowngrade = ({ sessionId: incoming }: { sessionId: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onModeDowngrade?.();
  };
  const onEnded = ({ sessionId: incoming }: { sessionId: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onEnded?.();
  };

  socket.on('call:ai:ready', onReady);
  socket.on('call:ai:agent_text', onAgentText);
  socket.on('call:ai:user_text', onUserText);
  socket.on('call:ai:caption_partial', onCaptionPartial);
  socket.on('call:ai:caption_final', onCaptionFinal);
  socket.on('call:ai:turn_state', onTurnState);
  socket.on('call:ai:barge_in', onBargeIn);
  socket.on('call:ai:agent_audio_chunk', onAgentAudioChunk);
  socket.on('call:ai:listening', onListening);
  socket.on('call:ai:speaking', onSpeaking);
  socket.on('call:ai:error', onError);
  socket.on('call:ai:audio_received', onAudioReceived);
  socket.on('call:ai:mode_downgrade', onModeDowngrade);
  socket.on('call:ai:ended', onEnded);

  await ensureConnected();

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('AI call start timed out. Check backend socket handlers.'));
    }, START_TIMEOUT_MS);
    socket.emit('call:ai:start', { sessionId, vehicleId: options?.vehicleId }, (ack: any) => {
      clearTimeout(timeout);
      if (ack?.ok) resolve();
      else reject(new Error(ack?.error ?? 'Unable to start AI call'));
    });
  });

  const sendText = (text: string) =>
    new Promise<void>((resolve, reject) => {
      socket.emit('call:ai:user_text', { sessionId, text }, (ack: any) => {
        if (ack?.ok) resolve();
        else reject(new Error(ack?.error ?? 'Unable to send text'));
      });
    });

  const sendAudioChunk = (audioBase64: string, mimeType = 'audio/mp4') =>
    new Promise<void>((resolve, reject) => {
      socket.emit('call:ai:audio_chunk', { sessionId, audioBase64, mimeType }, (ack: any) => {
        if (ack?.ok) resolve();
        else reject(new Error(ack?.error ?? 'Unable to send audio chunk'));
      });
    });

  const sendAudioFrame = (
    frameBase64: string,
    sampleRate = 16000,
    channels = 1,
    sequence = 0,
    timestamp = Date.now()
  ) =>
    new Promise<void>((resolve, reject) => {
      socket.emit(
        'call:ai:audio_frame',
        { sessionId, frameBase64, sampleRate, channels, sequence, timestamp },
        (ack: any) => {
          if (ack?.ok) resolve();
          else reject(new Error(ack?.error ?? 'Unable to send audio frame'));
        }
      );
    });

  const sendVideoFrame = (frameBase64: string, mimeType = 'image/jpeg') =>
    new Promise<void>((resolve, reject) => {
      socket.emit('call:ai:video_frame', { sessionId, frameBase64, mimeType }, (ack: any) => {
        if (ack?.ok) resolve();
        else reject(new Error(ack?.error ?? 'Unable to send video frame'));
      });
    });

  const stop = async () => {
    await new Promise<void>((resolve, reject) => {
      socket.emit('call:ai:stop', { sessionId }, (ack: any) => {
        if (ack?.ok) resolve();
        else reject(new Error(ack?.error ?? 'Unable to stop AI call'));
      });
    }).catch(() => {
      // Avoid throwing during navigation cleanup.
    });
    socket.off('call:ai:ready', onReady);
    socket.off('call:ai:agent_text', onAgentText);
    socket.off('call:ai:user_text', onUserText);
    socket.off('call:ai:caption_partial', onCaptionPartial);
    socket.off('call:ai:caption_final', onCaptionFinal);
    socket.off('call:ai:turn_state', onTurnState);
    socket.off('call:ai:barge_in', onBargeIn);
    socket.off('call:ai:agent_audio_chunk', onAgentAudioChunk);
    socket.off('call:ai:listening', onListening);
    socket.off('call:ai:speaking', onSpeaking);
    socket.off('call:ai:error', onError);
    socket.off('call:ai:audio_received', onAudioReceived);
    socket.off('call:ai:mode_downgrade', onModeDowngrade);
    socket.off('call:ai:ended', onEnded);
  };

  return { sendText, sendAudioFrame, sendAudioChunk, sendVideoFrame, stop };
}

