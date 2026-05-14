import { Server, Socket } from 'socket.io';
import { UserModel } from '../models/User';
import { buildVehicleContextForCall } from '../services/vehicle-context-builder';
import {
  RelaySession,
  createGeminiStreamRelaySession,
} from '../services/gemini-stream-relay.service';
import { recordEndedAiCall } from '../services/ai-call-transcript.service';

const MAX_HISTORY_MESSAGES = 20;
const MAX_TEXT_LENGTH = 1000;
const MAX_BASE64_CHUNK_SIZE = 2_000_000;
const MAX_PCM_FRAME_BASE64_SIZE = 120_000;

function stripDataUriPrefix(value: string): string {
  return value.replace(/^data:[^;]+;base64,/, '').trim();
}

interface SessionState {
  relay: RelaySession;
  userId: string;
  vehicleId: string | null;
  startedAt: number;
  messages: { role: 'user' | 'model'; content: string }[];
}

const sessions = new Map<string, SessionState>();

export function registerLiveAiHandlers(io: Server, socket: Socket) {
  socket.on(
    'call:ai:start',
    async (
      payload: { sessionId: string; vehicleId?: string; priorConversationSummary?: string },
      ack?: (ok: unknown) => void
    ) => {
      try {
        const sessionId = payload.sessionId?.trim();
        if (!sessionId) {
          throw new Error('sessionId is required');
        }

        const room = `call-ai:${sessionId}`;
        const userId = String(socket.data.userId || '');
        if (!userId) throw new Error('socket user not authenticated');

        socket.join(room);

        const user = await UserModel.findById(userId).lean();
        const resolvedVehicleId = payload.vehicleId || (user?.selectedVehicleId as any)?.toString();
        const vehicleContext = await buildVehicleContextForCall({
          userId,
          vehicleId: resolvedVehicleId || null,
        });

        const prior = (payload.priorConversationSummary || '').trim().slice(0, 8000);
        const profileWithResume = prior
          ? `${vehicleContext.profileSummary}\n\nPrevious video AI conversation summary (user is continuing):\n${prior}`
          : vehicleContext.profileSummary;

        if (sessions.has(sessionId)) {
          const existing = sessions.get(sessionId)!;
          await existing.relay.stop();
        }

        const relay = await createGeminiStreamRelaySession({
          vehicleContext: profileWithResume,
          callbacks: {
            onUserText: (text) => {
              const state = sessions.get(sessionId);
              if (!state) return;
              const cleaned = text.trim();
              if (!cleaned) return;
              state.messages.push({ role: 'user', content: cleaned });
              state.messages = state.messages.slice(-MAX_HISTORY_MESSAGES);
              io.to(room).emit('call:ai:user_text', { sessionId, text: cleaned });
              io.to(room).emit('call:ai:turn_state', { sessionId, state: 'user_speaking' });
            },
            onAgentText: (text) => {
              const state = sessions.get(sessionId);
              if (!state) return;
              state.messages.push({ role: 'model', content: text });
              state.messages = state.messages.slice(-MAX_HISTORY_MESSAGES);
              io.to(room).emit('call:ai:agent_text', { sessionId, text });
            },
            onCaptionPartial: (text) => {
              const cleaned = text.trim();
              if (!cleaned) return;
              io.to(room).emit('call:ai:caption_partial', { sessionId, text: cleaned });
            },
            onCaptionFinal: (text) => {
              const cleaned = text.trim();
              if (!cleaned) return;
              io.to(room).emit('call:ai:caption_final', { sessionId, text: cleaned });
            },
            onAgentAudioChunk: (base64Audio, mimeType) => {
              io.to(room).emit('call:ai:agent_audio_chunk', {
                sessionId,
                audioBase64: base64Audio,
                mimeType,
              });
            },
            onListening: () => {
              io.to(room).emit('call:ai:listening', { sessionId });
            },
            onSpeaking: () => {
              io.to(room).emit('call:ai:speaking', { sessionId });
              io.to(room).emit('call:ai:turn_state', { sessionId, state: 'ai_speaking' });
            },
            onTurnState: (stateName) => {
              io.to(room).emit('call:ai:turn_state', { sessionId, state: stateName });
            },
            onBargeIn: () => {
              io.to(room).emit('call:ai:barge_in', { sessionId });
            },
            onModeDowngrade: () => {
              io.to(room).emit('call:ai:mode_downgrade', { sessionId });
            },
            onError: (message) => {
              io.to(room).emit('call:ai:error', { sessionId, message });
            },
          },
        });

        sessions.set(sessionId, {
          relay,
          userId,
          vehicleId: resolvedVehicleId ? String(resolvedVehicleId) : null,
          startedAt: Date.now(),
          messages: [
            {
              role: 'model',
              content:
                'Connected. Ask your vehicle question in English or Sinhala (සිංහල)—I will help in real time in the same language.',
            },
          ],
        });

        io.to(room).emit('call:ai:ready', {
          sessionId,
          vehicleId: vehicleContext.vehicleId,
          canonicalVehicleKey: vehicleContext.canonicalVehicleKey,
        });
        io.to(room).emit('call:ai:turn_state', { sessionId, state: 'idle' });
        ack?.({ ok: true });
      } catch (e) {
        ack?.({
          ok: false,
          error: e instanceof Error ? e.message : 'Unable to start AI call',
        });
      }
    }
  );

  socket.on(
    'call:ai:user_text',
    async (
      payload: { sessionId: string; text: string },
      ack?: (ok: unknown) => void
    ) => {
      const sessionId = payload.sessionId?.trim();
      const text = payload.text?.trim();
      if (!sessionId || !text) {
        ack?.({ ok: false, error: 'sessionId and text are required' });
        return;
      }
      if (text.length > MAX_TEXT_LENGTH) {
        ack?.({ ok: false, error: 'text is too long' });
        return;
      }
      const state = sessions.get(sessionId);
      if (!state) {
        ack?.({ ok: false, error: 'session not started' });
        return;
      }

      state.messages.push({ role: 'user', content: text });
      state.messages = state.messages.slice(-MAX_HISTORY_MESSAGES);

      const room = `call-ai:${sessionId}`;
      io.to(room).emit('call:ai:user_text', { sessionId, text });

      ack?.({ ok: true });

      console.log('[live-ai] user_text received:', { sessionId, text: text.substring(0, 80) });
      try {
        const reply = await state.relay.sendUserText(text);
        console.log('[live-ai] user_text reply:', reply?.substring(0, 120));
        if (reply) {
          state.messages.push({ role: 'model', content: reply });
          state.messages = state.messages.slice(-MAX_HISTORY_MESSAGES);
        }
      } catch (e) {
        console.error('[live-ai] user_text error:', e);
        io.to(room).emit('call:ai:error', {
          sessionId,
          message: e instanceof Error ? e.message : 'AI call failed',
        });
      }
    }
  );

  socket.on(
    'call:ai:audio_frame',
    async (
      payload: {
        sessionId: string;
        frameBase64: string;
        sampleRate?: number;
        channels?: number;
        sequence?: number;
        timestamp?: number;
      },
      ack?: (ok: unknown) => void
    ) => {
      try {
        const sessionId = payload.sessionId?.trim();
        if (!sessionId) throw new Error('sessionId is required');
        const cleanedFrame = stripDataUriPrefix(payload.frameBase64 || '');
        if (!cleanedFrame) throw new Error('frameBase64 is required');
        if (cleanedFrame.length > MAX_PCM_FRAME_BASE64_SIZE) {
          throw new Error('pcm frame too large');
        }
        const sampleRate = Number(payload.sampleRate || 16000);
        const channels = Number(payload.channels || 1);
        if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 48000) {
          throw new Error('invalid sampleRate');
        }
        if (!Number.isFinite(channels) || channels < 1 || channels > 2) {
          throw new Error('invalid channels');
        }

        const state = sessions.get(sessionId);
        if (!state) throw new Error('session not started');
        await state.relay.sendAudioFrame(
          cleanedFrame,
          sampleRate,
          channels,
          Number(payload.sequence || 0),
          Number(payload.timestamp || Date.now())
        );
        io.to(`call-ai:${sessionId}`).emit('call:ai:audio_received', {
          sessionId,
          mimeType: `audio/pcm;rate=${sampleRate}`,
          size: cleanedFrame.length,
          at: Date.now(),
        });
        ack?.({ ok: true });
      } catch (e) {
        const sessionId = payload.sessionId?.trim?.();
        if (sessionId) {
          io.to(`call-ai:${sessionId}`).emit('call:ai:error', {
            sessionId,
            message: e instanceof Error ? e.message : 'AI PCM relay failed',
          });
        }
        ack?.({
          ok: false,
          error: e instanceof Error ? e.message : 'AI PCM relay failed',
        });
      }
    }
  );

  socket.on(
    'call:ai:audio_chunk',
    async (
      payload: { sessionId: string; audioBase64: string; mimeType?: string },
      ack?: (ok: unknown) => void
    ) => {
      try {
        const sessionId = payload.sessionId?.trim();
        if (!sessionId) throw new Error('sessionId is required');
        const cleanedAudio = stripDataUriPrefix(payload.audioBase64 || '');
        if (!cleanedAudio) throw new Error('audioBase64 is required');
        if (cleanedAudio.length > MAX_BASE64_CHUNK_SIZE) {
          throw new Error('audio chunk too large');
        }

        const state = sessions.get(sessionId);
        if (!state) throw new Error('session not started');
        await state.relay.sendAudioChunk(cleanedAudio, payload.mimeType || 'audio/mp4');
        io.to(`call-ai:${sessionId}`).emit('call:ai:audio_received', {
          sessionId,
          mimeType: payload.mimeType || 'audio/mp4',
          size: cleanedAudio.length,
          at: Date.now(),
        });
        ack?.({ ok: true });
      } catch (e) {
        const sessionId = payload.sessionId?.trim?.();
        if (sessionId) {
          io.to(`call-ai:${sessionId}`).emit('call:ai:error', {
            sessionId,
            message: e instanceof Error ? e.message : 'AI audio relay failed',
          });
        }
        ack?.({
          ok: false,
          error: e instanceof Error ? e.message : 'AI audio relay failed',
        });
      }
    }
  );

  socket.on(
    'call:ai:video_frame',
    async (
      payload: { sessionId: string; frameBase64: string; mimeType?: string },
      ack?: (ok: unknown) => void
    ) => {
      try {
        const sessionId = payload.sessionId?.trim();
        if (!sessionId) throw new Error('sessionId is required');
        const cleanedFrame = stripDataUriPrefix(payload.frameBase64 || '');
        if (!cleanedFrame) throw new Error('frameBase64 is required');
        if (cleanedFrame.length > MAX_BASE64_CHUNK_SIZE) {
          throw new Error('video frame too large');
        }

        const state = sessions.get(sessionId);
        if (!state) throw new Error('session not started');
        await state.relay.sendVideoFrame(cleanedFrame, payload.mimeType || 'image/jpeg');
        ack?.({ ok: true });
      } catch (e) {
        const sessionId = payload.sessionId?.trim?.();
        if (sessionId) {
          io.to(`call-ai:${sessionId}`).emit('call:ai:error', {
            sessionId,
            message: e instanceof Error ? e.message : 'AI frame relay failed',
          });
        }
        ack?.({
          ok: false,
          error: e instanceof Error ? e.message : 'AI frame relay failed',
        });
      }
    }
  );

  socket.on(
    'call:ai:stop',
    async ({ sessionId }: { sessionId: string }, ack?: (ok: unknown) => void) => {
      try {
        const cleaned = sessionId?.trim();
        if (!cleaned) throw new Error('sessionId is required');
        const state = sessions.get(cleaned);
        if (state) {
          await state.relay.stop();
          const hasUserTurn = state.messages.some((m) => m.role === 'user');
          if (hasUserTurn) {
            void recordEndedAiCall({
              userId: state.userId,
              vehicleId: state.vehicleId,
              sessionId: cleaned,
              messages: [...state.messages],
              startedAt: state.startedAt,
            }).catch((err) => console.warn('[live-ai] persist transcript failed:', err));
          }
        }
        sessions.delete(cleaned);
        socket.leave(`call-ai:${cleaned}`);
        io.to(`call-ai:${cleaned}`).emit('call:ai:turn_state', { sessionId: cleaned, state: 'idle' });
        io.to(`call-ai:${cleaned}`).emit('call:ai:ended', { sessionId: cleaned });
        ack?.({ ok: true });
      } catch (e) {
        ack?.({
          ok: false,
          error: e instanceof Error ? e.message : 'Unable to stop AI call',
        });
      }
    }
  );

  socket.on('disconnect', async () => {
    const entries = Array.from(sessions.entries()).filter(
      ([, session]) => session.userId === String(socket.data.userId || '')
    );
    for (const [sessionId, state] of entries) {
      try {
        await state.relay.stop();
      } catch {
        // ignore
      }
      const hasUserTurn = state.messages.some((m) => m.role === 'user');
      if (hasUserTurn) {
        void recordEndedAiCall({
          userId: state.userId,
          vehicleId: state.vehicleId,
          sessionId,
          messages: [...state.messages],
          startedAt: state.startedAt,
        }).catch((err) => console.warn('[live-ai] persist transcript failed:', err));
      }
      sessions.delete(sessionId);
      io.to(`call-ai:${sessionId}`).emit('call:ai:ended', { sessionId });
    }
  });
}

