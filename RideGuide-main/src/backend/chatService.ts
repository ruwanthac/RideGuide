import { api } from './apiClient';
import { getSocket } from './socketClient';
import type { ChatMessage } from './types';

export async function joinChat(
  requestId: string,
  onMessage: (msg: ChatMessage) => void,
): Promise<{
  recent: ChatMessage[];
  send: (text: string) => Promise<void>;
  leave: () => void;
}> {
  const socket = await getSocket();
  const { data: recent } = await api.get<ChatMessage[]>(`/requests/${requestId}/messages`);

  const onIncoming = (msg: ChatMessage) => onMessage(msg);
  socket.on('chat:message', onIncoming);

  await new Promise<void>((resolve, reject) => {
    socket.emit('chat:join', { requestId }, (ack: any) => {
      if (ack?.ok) resolve();
      else reject(new Error(ack?.error ?? 'join failed'));
    });
  });

  const send = (text: string) =>
    new Promise<void>((resolve, reject) => {
      socket.emit('chat:send', { requestId, text }, (ack: any) => {
        if (ack?.ok) resolve();
        else reject(new Error(ack?.error ?? 'send failed'));
      });
    });

  const leave = () => {
    socket.emit('chat:leave', { requestId });
    socket.off('chat:message', onIncoming);
  };

  return { recent, send, leave };
}
