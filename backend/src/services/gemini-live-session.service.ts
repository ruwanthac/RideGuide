import { GoogleGenAI, Modality } from '@google/genai';
import https from 'https';
import { env } from '../config/env';

type Role = 'user' | 'model';

export interface LiveSessionCallbacks {
  onUserText?: (text: string) => void;
  onAgentText?: (text: string) => void;
  onCaptionPartial?: (text: string) => void;
  onCaptionFinal?: (text: string) => void;
  onAgentAudioChunk?: (base64Audio: string, mimeType: string) => void;
  onListening?: () => void;
  onSpeaking?: () => void;
  onTurnState?: (state: 'user_speaking' | 'ai_speaking' | 'idle') => void;
  onBargeIn?: () => void;
  onModeDowngrade?: () => void;
  onError?: (message: string) => void;
}

export interface GeminiLiveSession {
  addUserText: (text: string) => Promise<string>;
  addAudioFrame: (
    audioBase64: string,
    sampleRate?: number,
    channels?: number,
    sequence?: number,
    timestamp?: number
  ) => Promise<void>;
  addAudioChunk: (audioBase64: string, mimeType: string) => Promise<void>;
  addVideoFrame: (frameBase64: string, mimeType: string) => Promise<void>;
  close: () => Promise<void>;
}

interface SessionState {
  history: { role: Role; content: string }[];
  liveSession: any | null;
  closedByClient: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  liveDisabled: boolean;
  lastFallbackReplyAt: number;
  latestVideoFrame?: { frameBase64: string; mimeType: string };
  lastInputTranscript?: string;
  aiSpeakingActive: boolean;
  pendingCaptionFinal?: string;
  pendingCaptionTimer: NodeJS.Timeout | null;
  lastTransientErrorAt: number;
  pcmDropStartedAt: number;
  modeDowngradeFired: boolean;
}

const MAX_LIVE_RECONNECT_ATTEMPTS = 3;

const MAX_HISTORY_MESSAGES = 24;
const WAIT_FOR_TEXT_REPLY_MS = 8000;
const MIN_FALLBACK_REPLY_INTERVAL_MS = 1200;
const MIN_AUDIO_CHUNK_BASE64_SIZE = 500;

const LIVE_SYSTEM_PROMPT = `You are a live AI mechanic assistant for ANY vehicle make/model.
You can receive text, audio transcripts, and vehicle camera context.
Give practical and safety-first vehicle troubleshooting guidance.
When uncertain, ask concise clarifying questions.

Important behavior:
- Treat stored profile vehicle context as a default hint only, NOT a hard restriction.
- If camera/audio/user text indicates a different vehicle than profile context, prioritize the currently observed/mentioned vehicle.
- If there is a mismatch, briefly confirm it and continue helping for the currently observed/mentioned vehicle.
- Never refuse help just because the vehicle is not the profile/default vehicle.
- If exact trim/year is unknown, provide best-effort generic guidance and ask for missing details.`;
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

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseTranscriptReplyPayload(raw: string): { transcript?: string; reply?: string } | null {
  const direct = safeJsonParse<{ transcript?: string; reply?: string }>(raw);
  if (direct && (typeof direct.transcript === 'string' || typeof direct.reply === 'string')) {
    return direct;
  }

  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const fenced = safeJsonParse<{ transcript?: string; reply?: string }>(withoutFence);
  if (fenced && (typeof fenced.transcript === 'string' || typeof fenced.reply === 'string')) {
    return fenced;
  }

  const match = withoutFence.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const extracted = safeJsonParse<{ transcript?: string; reply?: string }>(match[0]);
  if (extracted && (typeof extracted.transcript === 'string' || typeof extracted.reply === 'string')) {
    return extracted;
  }
  return null;
}

function normalizeAudioMimeType(mimeType: string): string {
  const lowered = (mimeType || '').toLowerCase();
  if (lowered === 'audio/m4a') return 'audio/mp4';
  return mimeType || 'audio/webm';
}

async function fallbackGenerateContent(parts: any[], systemInstruction: string): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const modelName = env.GEMINI_MODEL_CHEAP || 'gemini-2.5-flash';
  const payload = JSON.stringify({
    system_instruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;
  const body = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`Fallback generateContent failed (${res.statusCode ?? 'n/a'}): ${data}`));
            return;
          }
          resolve(data);
        });
      }
    );
    req.on('error', (error) => reject(error));
    req.write(payload);
    req.end();
  });
  const parsed = safeJsonParse<any>(body);
  const allParts: any[] = parsed?.candidates?.[0]?.content?.parts || [];
  const text = allParts
    .filter((part: any) => !part?.thought)
    .map((part: any) => part?.text || '')
    .join('');
  return String(text).trim();
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
    reconnecting: false,
    reconnectAttempts: 0,
    liveDisabled: false,
    lastFallbackReplyAt: 0,
    latestVideoFrame: undefined,
    lastInputTranscript: undefined,
    aiSpeakingActive: false,
    pendingCaptionFinal: undefined,
    pendingCaptionTimer: null,
    lastTransientErrorAt: 0,
    pcmDropStartedAt: 0,
    modeDowngradeFired: false,
  };

  const client = getClient();
  const fallbackSystemInstruction = `${LIVE_SYSTEM_PROMPT}\n\nVehicle Context:\n${params.vehicleContext}`;
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
              params.callbacks.onTurnState?.('user_speaking');
              if (state.aiSpeakingActive) {
                params.callbacks.onBargeIn?.();
                state.aiSpeakingActive = false;
              }
              const cleaned = inputTranscript.trim();
              if (cleaned !== state.lastInputTranscript) {
                state.lastInputTranscript = cleaned;
                params.callbacks.onUserText?.(cleaned);
              }
            }

            const parts = message?.serverContent?.modelTurn?.parts;
            if (!Array.isArray(parts)) return;
            for (const part of parts) {
              if (typeof part?.text === 'string' && part.text.trim().length > 0) {
                queueModelText(part.text);
                params.callbacks.onAgentText?.(part.text);
                params.callbacks.onCaptionPartial?.(part.text.trim());
                state.pendingCaptionFinal = part.text.trim();
                if (state.pendingCaptionTimer) clearTimeout(state.pendingCaptionTimer);
                state.pendingCaptionTimer = setTimeout(() => {
                  if (!state.pendingCaptionFinal) return;
                  params.callbacks.onCaptionFinal?.(state.pendingCaptionFinal);
                  state.pendingCaptionFinal = undefined;
                }, 300);
              }
              const inlineData = part?.inlineData;
              if (
                typeof inlineData?.data === 'string' &&
                inlineData.data.length > 0 &&
                typeof inlineData?.mimeType === 'string' &&
                inlineData.mimeType.startsWith('audio/')
              ) {
                params.callbacks.onSpeaking?.();
                params.callbacks.onTurnState?.('ai_speaking');
                state.aiSpeakingActive = true;
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
            const isMimeTypeError = String(closeReason).includes('Mime type');
            if (!isMimeTypeError || state.reconnectAttempts === 0) {
              console.warn('[gemini-live] onclose', { model: modelName, closeCode, closeReason });
            }
            if (!state.closedByClient) {
              if (isMimeTypeError) {
                state.liveDisabled = true;
                console.log('[gemini-live] Live WS disabled due to mime type rejection, using REST fallback only');
                return;
              }
              if (!(closeCode === 1006 && closeReason === 'unknown')) {
                params.callbacks.onError?.(
                  `Live voice session disconnected (${closeCode ?? 'n/a'}: ${closeReason}).`
                );
              }
              state.reconnectAttempts++;
              if (state.reconnectAttempts > MAX_LIVE_RECONNECT_ATTEMPTS) {
                state.liveDisabled = true;
                console.log('[gemini-live] Max reconnect attempts reached, using REST fallback only');
                return;
              }
              if (!state.reconnecting) {
                state.reconnecting = true;
                setTimeout(() => {
                  if (state.closedByClient || state.liveDisabled) {
                    state.reconnecting = false;
                    return;
                  }
                  void connectLiveSession()
                    .catch(() => {})
                    .finally(() => {
                      state.reconnecting = false;
                    });
                }, 2000);
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

  try {
    await connectLiveSession();
  } catch (error) {
    // Keep degraded mode available even when Live websocket is unavailable.
    state.liveSession = null;
    params.callbacks.onError?.('Live voice session unavailable. Using fallback voice processing.');
  }

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
      const parts: any[] = [{ text }];
      if (state.latestVideoFrame?.frameBase64) {
        parts.push({
          inlineData: {
            mimeType: state.latestVideoFrame.mimeType || 'image/jpeg',
            data: state.latestVideoFrame.frameBase64,
          },
        });
      }
      const raw = await fallbackGenerateContent(parts as any, fallbackSystemInstruction);
      const parsed = parseTranscriptReplyPayload(raw);
      const transcript = parsed?.transcript?.trim() || '';
      const reply = parsed?.reply?.trim() || raw;
      if (transcript) {
        params.callbacks.onUserText?.(transcript);
      }
      if (reply) {
        params.callbacks.onAgentText?.(reply);
        params.callbacks.onCaptionFinal?.(reply);
        params.callbacks.onTurnState?.('ai_speaking');
        state.aiSpeakingActive = true;
        return reply;
      }
      throw new Error('Live voice session unavailable.');
    }
    params.callbacks.onListening?.();
    params.callbacks.onTurnState?.('user_speaking');
    if (state.aiSpeakingActive) {
      params.callbacks.onBargeIn?.();
      state.aiSpeakingActive = false;
    }
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
    console.log('[gemini-live] addAudioChunk called:', { mimeType, size: audioBase64.length, liveDisabled: state.liveDisabled, hasLiveSession: !!state.liveSession });
    params.callbacks.onListening?.();

    const looksLikePcm =
      (mimeType || '').toLowerCase().includes('audio/pcm') ||
      (mimeType || '').toLowerCase().includes('audio/l16');

    // For true PCM streaming mode, do not run generateContent fallback per frame.
    // If live session is down, silently keep trying reconnect and drop frames.
    if (looksLikePcm && !state.liveSession) {
      if (!state.reconnecting && !state.liveDisabled) {
        state.reconnecting = true;
        void connectLiveSession()
          .then(() => {
            state.pcmDropStartedAt = 0;
            state.modeDowngradeFired = false;
          })
          .catch(() => {})
          .finally(() => {
            state.reconnecting = false;
          });
      }
      const now = Date.now();
      if (state.pcmDropStartedAt === 0) {
        state.pcmDropStartedAt = now;
      }
      const PCM_DROP_DOWNGRADE_MS = 5000;
      if (
        !state.modeDowngradeFired &&
        now - state.pcmDropStartedAt > PCM_DROP_DOWNGRADE_MS
      ) {
        state.modeDowngradeFired = true;
        params.callbacks.onModeDowngrade?.();
      }
      if (now - state.lastTransientErrorAt > 4000) {
        state.lastTransientErrorAt = now;
        params.callbacks.onError?.('Live audio reconnecting... still listening for your voice.');
      }
      return;
    }

    if (!looksLikePcm) {
      if ((audioBase64 || '').length < MIN_AUDIO_CHUNK_BASE64_SIZE) {
        console.log('[gemini-live] audio chunk too small, skipping:', audioBase64.length);
        return;
      }
      const now = Date.now();
      if (now - state.lastFallbackReplyAt < MIN_FALLBACK_REPLY_INTERVAL_MS) {
        console.log('[gemini-live] rate limited, skipping fallback');
        return;
      }
      console.log('[gemini-live] sending audio via REST fallback:', { mimeType, size: audioBase64.length });
      try {
        const parts: any[] = [
          {
            text:
              'Transcribe the user voice and answer as a concise vehicle mechanic. Return strict JSON: {"transcript":"...","reply":"..."}. If speech is unclear/silent/noise-only, return {"transcript":"","reply":"[NO_SPEECH]"}.',
          },
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: audioBase64,
            },
          },
        ];
        if (state.latestVideoFrame?.frameBase64) {
          parts.push({
            inlineData: {
              mimeType: state.latestVideoFrame.mimeType || 'image/jpeg',
              data: state.latestVideoFrame.frameBase64,
            },
          });
        }
        const raw = await fallbackGenerateContent(parts as any, fallbackSystemInstruction);
        console.log('[gemini-live] REST fallback response:', raw.substring(0, 200));
        const parsed = parseTranscriptReplyPayload(raw);
        const transcript = parsed?.transcript?.trim() || '';
        const replyText = (parsed?.reply?.trim() || raw).trim();
        if (transcript) {
          params.callbacks.onUserText?.(transcript);
        }
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
          params.callbacks.onCaptionFinal?.(replyText);
          params.callbacks.onTurnState?.('ai_speaking');
          state.aiSpeakingActive = true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Voice fallback processing failed.';
        const lowered = message.toLowerCase();
        const transientNetwork =
          lowered.includes('epipe') ||
          lowered.includes('tls') ||
          lowered.includes('socket disconnected') ||
          lowered.includes('fetch failed');
        if (transientNetwork) {
          const now = Date.now();
          if (now - state.lastTransientErrorAt > 4000) {
            state.lastTransientErrorAt = now;
            params.callbacks.onError?.('Network is unstable. Reconnecting voice service...');
          }
        } else {
          params.callbacks.onError?.(message);
        }
      }
      return;
    }

    state.pcmDropStartedAt = 0;
    state.modeDowngradeFired = false;

    const resolvedMimeType = normalizeAudioMimeType(mimeType || 'audio/pcm;rate=16000');
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

  const addAudioFrame = async (
    audioBase64: string,
    sampleRate = 16000,
    channels = 1
  ): Promise<void> => {
    if (!audioBase64) return;
    const pcmMimeType = `audio/pcm;rate=${sampleRate}`;
    await addAudioChunk(audioBase64, pcmMimeType);
  };

  const addVideoFrame = async (frameBase64: string, mimeType: string): Promise<void> => {
    if (!frameBase64) return;
    state.latestVideoFrame = { frameBase64, mimeType: mimeType || 'image/jpeg' };
    if (!state.liveSession) return;
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
    params.callbacks.onTurnState?.('idle');
    state.aiSpeakingActive = false;
    if (state.pendingCaptionTimer) {
      clearTimeout(state.pendingCaptionTimer);
      state.pendingCaptionTimer = null;
    }
    try {
      state.liveSession?.close?.();
    } catch {
      // ignore
    }
    state.liveSession = null;
    state.history = [];
    state.latestVideoFrame = undefined;
  };

  return { addUserText, addAudioFrame, addAudioChunk, addVideoFrame, close };
}

