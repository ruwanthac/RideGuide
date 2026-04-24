import { Server, Socket } from 'socket.io';
import { chatReply } from '../services/gemini.client';

type Role = 'user' | 'model';

interface LiveAiMessage {
  role: Role;
  content: string;
}

interface SessionState {
  messages: LiveAiMessage[];
}

const MAX_HISTORY_MESSAGES = 20;
const MAX_TEXT_LENGTH = 1000;

export function registerLiveAiHandlers(io: Server, socket: Socket) {
  const sessions = new Map<string, SessionState>();

  socket.on(
    'call:ai:start',
    ({ sessionId }: { sessionId: string }, ack?: (ok: unknown) => void) => {
      try {
        if (!sessionId || sessionId.trim().length === 0) {
          throw new Error('sessionId is required');
        }
        const cleaned = sessionId.trim();
        socket.join(`call-ai:${cleaned}`);
        if (!sessions.has(cleaned)) {
          sessions.set(cleaned, {
            messages: [
              {
                role: 'model',
                content:
                  'Connected. Ask your vehicle question and I will help in real time.',
              },
            ],
          });
        }
        io.to(`call-ai:${cleaned}`).emit('call:ai:ready', { sessionId: cleaned });
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
      try {
        const sessionId = payload.sessionId?.trim();
        const text = payload.text?.trim();
        if (!sessionId) throw new Error('sessionId is required');
        if (!text) throw new Error('text is required');
        if (text.length > MAX_TEXT_LENGTH) throw new Error('text is too long');

        const room = `call-ai:${sessionId}`;
        const state = sessions.get(sessionId);
        if (!state) throw new Error('session not started');

        const userMessage: LiveAiMessage = { role: 'user', content: text };
        state.messages.push(userMessage);
        state.messages = state.messages.slice(-MAX_HISTORY_MESSAGES);

        io.to(room).emit('call:ai:user_text', { sessionId, text });

        const reply = await chatReply(state.messages);
        const modelMessage: LiveAiMessage = { role: 'model', content: reply };
        state.messages.push(modelMessage);
        state.messages = state.messages.slice(-MAX_HISTORY_MESSAGES);

        io.to(room).emit('call:ai:agent_text', { sessionId, text: reply });
        ack?.({ ok: true });
      } catch (e) {
        const sessionId = payload.sessionId?.trim?.();
        if (sessionId) {
          io.to(`call-ai:${sessionId}`).emit('call:ai:error', {
            sessionId,
            message: e instanceof Error ? e.message : 'AI call failed',
          });
        }
        ack?.({
          ok: false,
          error: e instanceof Error ? e.message : 'AI call failed',
        });
      }
    }
  );

  socket.on(
    'call:ai:stop',
    ({ sessionId }: { sessionId: string }, ack?: (ok: unknown) => void) => {
      try {
        const cleaned = sessionId?.trim();
        if (!cleaned) throw new Error('sessionId is required');
        sessions.delete(cleaned);
        socket.leave(`call-ai:${cleaned}`);
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
}

