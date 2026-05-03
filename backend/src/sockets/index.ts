import { Server as HttpServer } from 'http';
import { Server as IoServer, Socket } from 'socket.io';
import { verifyToken } from '../services/auth.service';
import { env } from '../config/env';
import { registerChatHandlers } from './chat.socket';
import { registerLiveAiHandlers } from './live-ai.socket';

let io: IoServer | null = null;

export function attachSockets(httpServer: HttpServer): IoServer {
  const server = new IoServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') },
  });

  server.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('missing token'));
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('invalid token'));
    }
  });

  server.on('connection', (socket: Socket) => {
    const role = socket.data.role as string;
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    if (role === 'mechanic') socket.join('providers:mechanic');
    if (role === 'tow') socket.join('providers:tow');
    socket.on('request:join', (requestId: string) => {
      if (typeof requestId === 'string' && requestId.trim()) socket.join(`request:${requestId}`);
    });
    socket.on('request:leave', (requestId: string) => {
      if (typeof requestId === 'string' && requestId.trim()) socket.leave(`request:${requestId}`);
    });
    registerChatHandlers(server, socket);
    registerLiveAiHandlers(server, socket);
  });

  io = server;
  return server;
}

export function getIo(): IoServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
