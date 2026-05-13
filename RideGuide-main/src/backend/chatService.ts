import { api } from './apiClient';
import { getSocket } from './socketClient';
import type { ChatMessage } from './types';
import type { Socket } from 'socket.io-client';

type ChatHandler = (msg: ChatMessage) => void;

const chatHandlers = new Set<ChatHandler>();

function dispatchChatMessage(raw: unknown) {
  const msg = raw as ChatMessage;
  chatHandlers.forEach((h) => {
    try {
      h(msg);
    } catch {
      /* ignore subscriber errors */
    }
  });
}

function wireSocketChatInbound(socket: Socket) {
  socket.off('chat:message', dispatchChatMessage);
  socket.on('chat:message', dispatchChatMessage);
}

/** Subscribe to all `chat:message` events (caller should filter by `requestId` if needed). */
export function subscribeChatMessages(handler: ChatHandler): () => void {
  chatHandlers.add(handler);
  return () => {
    chatHandlers.delete(handler);
  };
}

/** Join the request chat room (idempotent for this socket). */
export async function joinRequestChatRoom(requestId: string): Promise<void> {
  const socket = await getSocket();
  wireSocketChatInbound(socket);
  await new Promise<void>((resolve, reject) => {
    socket.emit('chat:join', { requestId }, (ack: any) => {
      if (ack?.ok) resolve();
      else reject(new Error(ack?.error ?? 'join failed'));
    });
  });
}

export async function leaveRequestChatRoom(requestId: string): Promise<void> {
  const socket = await getSocket();
  socket.emit('chat:leave', { requestId });
}

export async function joinChat(
  requestId: string,
  onMessage: (msg: ChatMessage) => void,
): Promise<{
  recent: ChatMessage[];
  send: (text: string) => Promise<void>;
  leave: () => void;
}> {
  const socket = await getSocket();
  wireSocketChatInbound(socket);
  const { data: recent } = await api.get<ChatMessage[]>(`/requests/${requestId}/messages`);

  const handler = (msg: ChatMessage) => {
    if (String(msg.requestId) !== String(requestId)) return;
    onMessage(msg);
  };
  chatHandlers.add(handler);

  await joinRequestChatRoom(requestId).catch((e) => {
    chatHandlers.delete(handler);
    throw e;
  });

  const send = (text: string) =>
    new Promise<void>((resolve, reject) => {
      socket.emit('chat:send', { requestId, text }, (ack: any) => {
        if (ack?.ok) resolve();
        else reject(new Error(ack?.error ?? 'send failed'));
      });
    });

  const leave = () => {
    chatHandlers.delete(handler);
  };

  return { recent, send, leave };
}
