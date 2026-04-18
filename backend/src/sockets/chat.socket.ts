import { Server, Socket } from 'socket.io';
import { addMessage, assertMember, listMessages } from '../services/chat.service';

export function registerChatHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;
  const role = socket.data.role as string;

  socket.on('chat:join', async ({ requestId }: { requestId: string }, ack?: (ok: unknown) => void) => {
    try {
      await assertMember(requestId, userId, role);
      socket.join(`request:${requestId}`);
      const recent = await listMessages(requestId, userId, role);
      ack?.({ ok: true, recent });
    } catch (e) {
      ack?.({ ok: false, error: e instanceof Error ? e.message : 'join failed' });
    }
  });

  socket.on('chat:leave', ({ requestId }: { requestId: string }) => {
    socket.leave(`request:${requestId}`);
  });

  socket.on('chat:send', async ({ requestId, text }: { requestId: string; text: string }, ack?: (ok: unknown) => void) => {
    try {
      if (!text || text.length > 2000) throw new Error('invalid text');
      const msg = await addMessage(requestId, userId, role, text);
      io.to(`request:${requestId}`).emit('chat:message', msg.toObject());
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, error: e instanceof Error ? e.message : 'send failed' });
    }
  });
}
