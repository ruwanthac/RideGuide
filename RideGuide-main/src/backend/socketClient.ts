import { io, Socket } from 'socket.io-client';
import { getAuthToken, api } from './apiClient';

const baseURL = api.defaults.baseURL?.replace(/\/api$/, '') ?? 'http://localhost:3000';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;
  const token = await getAuthToken();
  socket = io(baseURL, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
