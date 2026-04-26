import { GoogleGenAI, Modality } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';

type Role = 'user' | 'model';

export interface LiveSessionCallbacks {
  onAgentText?: (text: string) => void;
  onAgentAudioChunk?: (base64Audio: string, mimeType: string) => void;
  onListening?: () => void;
  onSpeaking?: () => void;
  onError?: (message: string) => void;
}

export interface GeminiLiveSession {
  addUserText: (text: string) => Promise<string>;
  addAudioChunk: (audioBase64: string, mimeType: string) => Promise<void>;
  addVideoFrame: (frameBase64: string, mimeType: string) => Promise<void>;
  close: () => Promise<void>;
}

interface SessionState {
  history: { role: Role; content: string }[];
  liveSession: any | null;
  closedByClient: boolean;
  fallbackModel: any | null;
  reconnecting: boolean;
  lastFallbackReplyAt: number;
}

const MAX_HISTORY_MESSAGES = 24;
const WAIT_FOR_TEXT_REPLY_MS = 8000;
const MIN_FALLBACK_REPLY_INTERVAL_MS = 4500;
const MIN_AUDIO_CHUNK_BASE64_SIZE = 9000;

const LIVE_SYSTEM_PROMPT = `You are a live AI mechanic assistant.
You can receive text, audio transcripts, and vehicle camera context.
Give practical and safety-first vehicle troubleshooting guidance.
When uncertain, ask concise clarifying questions.`;
const LIVE_MODEL_FALLBACKS = [
  'gemini-2.5-flash-native-audio-latest',
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-3.1-flash-live-preview',
];

function getClient(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
}

function trimHistory(history: { role: Role; content: string }[]) {
  if (history.length > MAX_HISTORY_MESSAGES) {
    history.splice(0, history.length - MAX_HISTORY_MESSAGES);
  }
}

function safeResponseText(response: any): string {
  try {
    return typeof response?.text === 'function' ? response.text() : '';
  } catch {
    return '';
  }
}

export async function createGeminiLiveSession(params: {
  vehicleContext: string;
  callbacks: LiveSessionCallbacks;
}): Promise<GeminiLiveSession> {
  const state: SessionState = {
    history: [
      {
        role: 'model',
        content:
          'Connected. I am ready to help with live vehicle diagnosis using your vehicle profile.',
      },
    ],
    liveSession: null,
    closedByClient: false,
    fallbackModel: null,
    reconnecting: false,
    lastFallbackReplyAt: 0,
  };

  const client = getClient();
  if (env.GEMINI_API_KEY) {
    state.fallbackModel = new GoogleGenerativeAI(env.GEMINI_API_KEY).getGenerativeModel({
      model: env.GEMINI_MODEL_CHEAP || 'gemini-2.5-flash',
      systemInstruction: `${LIVE_SYSTEM_PROMPT}\n\nVehicle Context:\n${params.vehicleContext}`,
    });
  }
  const pendingTextWaiters: Array<(text: string) => void> = [];
  const modelTextQueue: string[] = [];

  const queueModelText = (text: string) => {
    const cleaned = text?.trim();
    if (!cleaned) return;
    if (pendingTextWaiters.length > 0) {
      const waiter = pendingTextWaiters.shift();
      waiter?.(cleaned);
    } else {
      modelTextQueue.push(cleaned);
    }
  };

  const requestedModel = env.GEMINI_MODEL_LIVE || LIVE_MODEL_FALLBACKS[0];
  const preferredModel = requestedModel;
  const modelCandidates = Array.from(new Set([preferredModel, ...LIVE_MODEL_FALLBACKS]));

  const connectLiveSession = async (): Promise<void> => {
    let connectError: unknown = null;
    for (const modelName of modelCandidates) {
      try {
        state.liveSession = await client.live.connect({
        model: modelName,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede',
              },
            },
          },
          systemInstruction: `${LIVE_SYSTEM_PROMPT}\n\nVehicle Context:\n${params.vehicleContext}`,
        } as any,
        callbacks: {
          onmessage: (message: any) => {
            const inputTranscript = message?.serverContent?.inputTranscription?.text;
            if (typeof inputTranscript === 'string' && inputTranscript.trim().length > 0) {
              params.callbacks.onListening?.();
            }

            const parts = message?.serverContent?.modelTurn?.parts;
            if (!Array.isArray(parts)) return;
            for (const part of parts) {
              if (typeof part?.text === 'string' && part.text.trim().length > 0) {
                queueModelText(part.text);
                params.callbacks.onAgentText?.(part.text);
              }
              const inlineData = part?.inlineData;
              if (
                typeof inlineData?.data === 'string' &&
                inlineData.data.length > 0 &&
                typeof inlineData?.mimeType === 'string' &&
                inlineData.mimeType.startsWith('audio/')
              ) {
                params.callbacks.onSpeaking?.();
                params.callbacks.onAgentAudioChunk?.(inlineData.data, inlineData.mimeType);
              }
            }
          },
          onerror: (event: any) => {
            const message =
              event?.message || event?.error?.message || 'Gemini Live session error';
            params.callbacks.onError?.(String(message));
            console.warn('[gemini-live] onerror', { model: modelName, message: String(message) });
          },
          onclose: (event: any) => {
            state.liveSession = null;
            const closeCode = event?.code;
            const closeReason = event?.reason || 'unknown';
            console.warn('[gemini-live] onclose', { model: modelName, closeCode, closeReason });
            if (!state.closedByClient) {
              if (!(closeCode === 1006 && closeReason === 'unknown')) {
                params.callbacks.onError?.(
                  `Live voice session disconnected (${closeCode ?? 'n/a'}: ${closeReason}).`
                );
              }
              if (!state.reconnecting) {
                state.reconnecting = true;
                setTimeout(() => {
                  if (state.closedByClient) {
                    state.reconnecting = false;
                    return;
                  }
                  void connectLiveSession()
                    .catch(() => {
                      // Stay on fallback mode if reconnect keeps failing.
                    })
                    .finally(() => {
                      state.reconnecting = false;
                    });
                }, 1200);
              }
            }
          },
        },
      });
        return;
      } catch (error) {
        connectError = error;
        console.warn('[gemini-live] connect failed', { model: modelName, error });
        state.liveSession = null;
      }
    }
    throw (connectError instanceof Error
      ? connectError
      : new Error('Unable to establish Gemini Live session with configured models.'));
  };

  await connectLiveSession();

  const waitForNextModelText = () =>
    new Promise<string>((resolve) => {
      if (modelTextQueue.length > 0) {
        resolve(modelTextQueue.shift() || '');
        return;
      }
      const timeout = setTimeout(() => {
        const index = pendingTextWaiters.indexOf(waiter);
        if (index >= 0) pendingTextWaiters.splice(index, 1);
        resolve('');
      }, WAIT_FOR_TEXT_REPLY_MS);
      const waiter = (text: string) => {
        clearTimeout(timeout);
        resolve(text);
      };
      pendingTextWaiters.push(waiter);
    });

  const addUserText = async (text: string): Promise<string> => {
    if (!state.liveSession) {
      if (!state.reconnecting) {
        state.reconnecting = true;
        void connectLiveSession()
          .catch(() => {
            // fallback remains available
          })
          .finally(() => {
            state.reconnecting = false;
          });
      }
      throw new Error('Live voice session unavailable.');
    }
    params.callbacks.onListening?.();
    state.history.push({ role: 'user', content: text });
    trimHistory(state.history);
    state.liveSession.sendClientContent({
      turns: [{ role: 'user', parts: [{ text }] }],
      turnComplete: true,
    });
    const replyText = await waitForNextModelText();
    if (replyText) {
      state.history.push({ role: 'model', content: replyText });
      trimHistory(state.history);
    }
    return replyText;
  };

  const addAudioChunk = async (audioBase64: string, mimeType: string): Promise<void> => {
    if (!audioBase64) return;
    params.callbacks.onListening?.();

    const looksLikePcm =
      (mimeType || '').toLowerCase().includes('audio/pcm') ||
      (mimeType || '').toLowerCase().includes('audio/l16');

    if (!state.liveSession || !looksLikePcm) {
      if (!state.fallbackModel) return;
      if ((audioBase64 || '').length < MIN_AUDIO_CHUNK_BASE64_SIZE) {
        return;
      }
      const now = Date.now();
      if (now - state.lastFallbackReplyAt < MIN_FALLBACK_REPLY_INTERVAL_MS) {
        return;
      }
      try {
        const result = await state.fallbackModel.generateContent([
          {
            text:
              'Transcribe the user voice and answer as a concise vehicle mechanic. If speech is unclear/silent/noise-only, return exactly [NO_SPEECH]. Return plain response text only.',
          },
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: audioBase64,
            },
          },
        ] as any);
        const response = (result as any)?.response || result;
        const replyText = safeResponseText(response).trim();
        if (!replyText || replyText === '[NO_SPEECH]' || /\[No speech detected\]/i.test(replyText)) {
          return;
        }
        if (replyText) {
          state.lastFallbackReplyAt = now;
          state.history.push({ role: 'user', content: '[voice message]' });
          state.history.push({ role: 'model', content: replyText });
          trimHistory(state.history);
          params.callbacks.onSpeaking?.();
          params.callbacks.onAgentText?.(replyText);
        }
      } catch (error) {
        params.callbacks.onError?.(
          error instanceof Error ? error.message : 'Voice fallback processing failed.'
        );
      }
      return;
    }

    const resolvedMimeType = mimeType || 'audio/pcm;rate=16000';
    const candidates = [
      { audio: { data: audioBase64, mimeType: resolvedMimeType } },
      { media: { data: audioBase64, mimeType: resolvedMimeType } },
      { realtimeInput: { mediaChunks: [{ data: audioBase64, mimeType: resolvedMimeType }] } },
    ];
    for (const payload of candidates) {
      try {
        state.liveSession.sendRealtimeInput(payload);
        return;
      } catch {
        // Try next supported payload shape.
      }
    }
    throw new Error('Unable to stream audio to Gemini Live.');
  };

  const addVideoFrame = async (frameBase64: string, mimeType: string): Promise<void> => {
    if (!state.liveSession || !frameBase64) return;
    const resolvedMimeType = mimeType || 'image/jpeg';
    const candidates = [
      { video: { data: frameBase64, mimeType: resolvedMimeType } },
      { media: { data: frameBase64, mimeType: resolvedMimeType } },
      { realtimeInput: { mediaChunks: [{ data: frameBase64, mimeType: resolvedMimeType }] } },
    ];
    for (const payload of candidates) {
      try {
        state.liveSession.sendRealtimeInput(payload);
        return;
      } catch {
        // Try next supported payload shape.
      }
    }
  };

  const close = async () => {
    state.closedByClient = true;
    try {
      state.liveSession?.close?.();
    } catch {
      // ignore
    }
    state.liveSession = null;
    state.history = [];
  };

  return { addUserText, addAudioChunk, addVideoFrame, close };
}

