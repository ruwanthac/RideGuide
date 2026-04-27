import { chatReply } from './gemini.client';
import {
  GeminiLiveSession,
  LiveSessionCallbacks,
  createGeminiLiveSession,
} from './gemini-live-session.service';

type Role = 'user' | 'model';

export interface RelaySession {
  sendUserText: (text: string) => Promise<string>;
  sendAudioFrame: (
    audioBase64: string,
    sampleRate?: number,
    channels?: number,
    sequence?: number,
    timestamp?: number
  ) => Promise<void>;
  sendAudioChunk: (audioBase64: string, mimeType: string) => Promise<void>;
  sendVideoFrame: (frameBase64: string, mimeType: string) => Promise<void>;
  stop: () => Promise<void>;
}

interface RelaySessionState {
  history: { role: Role; content: string }[];
  liveSession: GeminiLiveSession | null;
}

export async function createGeminiStreamRelaySession(params: {
  vehicleContext: string;
  callbacks: LiveSessionCallbacks;
}): Promise<RelaySession> {
  const state: RelaySessionState = {
    history: [
      {
        role: 'model',
        content: 'Connected. Ask your vehicle question and I will help in real time.',
      },
    ],
    liveSession: null,
  };

  try {
    state.liveSession = await createGeminiLiveSession({
      vehicleContext: params.vehicleContext,
      callbacks: params.callbacks,
    });
  } catch (error) {
    console.warn('[gemini-stream-relay] live session unavailable, using text fallback:', error);
    state.liveSession = null;
  }

  const sendUserText = async (text: string): Promise<string> => {
    state.history.push({ role: 'user', content: text });
    if (state.liveSession) {
      try {
        const reply = await state.liveSession.addUserText(text);
        state.history.push({ role: 'model', content: reply });
        return reply;
      } catch (error) {
        params.callbacks.onError?.(
          error instanceof Error
            ? error.message
            : 'Live AI failed, switching to text fallback.'
        );
      }
    }

    const reply = await chatReply(state.history);
    state.history.push({ role: 'model', content: reply });
    params.callbacks.onAgentText?.(reply);
    return reply;
  };

  const sendAudioChunk = async (audioBase64: string, mimeType: string) => {
    if (!state.liveSession) {
      throw new Error('Live voice session unavailable.');
    }
    await state.liveSession.addAudioChunk(audioBase64, mimeType);
  };

  const sendAudioFrame = async (
    audioBase64: string,
    sampleRate = 16000,
    channels = 1,
    sequence = 0,
    timestamp = Date.now()
  ) => {
    if (!state.liveSession) {
      throw new Error('Live PCM voice session unavailable.');
    }
    await state.liveSession.addAudioFrame(audioBase64, sampleRate, channels, sequence, timestamp);
  };

  const sendVideoFrame = async (frameBase64: string, mimeType: string) => {
    if (!state.liveSession) return;
    await state.liveSession.addVideoFrame(frameBase64, mimeType);
  };

  const stop = async () => {
    if (state.liveSession) {
      await state.liveSession.close();
    }
    state.history = [];
  };

  return { sendUserText, sendAudioFrame, sendAudioChunk, sendVideoFrame, stop };
}

