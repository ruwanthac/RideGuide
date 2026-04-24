import { getSocket } from './socketClient';

export type LiveAiStatus = 'calling' | 'connecting' | 'connected' | 'error' | 'ended';

export interface LiveAiCallbacks {
  onReady?: () => void;
  onAgentText?: (text: string) => void;
  onUserText?: (text: string) => void;
  onError?: (message: string) => void;
  onEnded?: () => void;
}

export async function joinLiveAiCall(
  sessionId: string,
  callbacks: LiveAiCallbacks
): Promise<{
  sendText: (text: string) => Promise<void>;
  stop: () => Promise<void>;
}> {
  const socket = await getSocket();
  const START_TIMEOUT_MS = 12000;

  const ensureConnected = () =>
    new Promise<void>((resolve, reject) => {
      if (socket.connected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Could not connect to server. Check backend and network.'));
      }, START_TIMEOUT_MS);

      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onConnectError = (err: Error) => {
        cleanup();
        reject(new Error(err?.message || 'Socket authentication failed'));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off('connect', onConnect);
        socket.off('connect_error', onConnectError);
      };

      socket.on('connect', onConnect);
      socket.on('connect_error', onConnectError);
    });

  const onReady = ({ sessionId: incoming }: { sessionId: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onReady?.();
  };
  const onAgentText = ({ sessionId: incoming, text }: { sessionId: string; text: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onAgentText?.(text);
  };
  const onUserText = ({ sessionId: incoming, text }: { sessionId: string; text: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onUserText?.(text);
  };
  const onError = ({
    sessionId: incoming,
    message,
  }: {
    sessionId: string;
    message: string;
  }) => {
    if (incoming !== sessionId) return;
    callbacks.onError?.(message);
  };
  const onEnded = ({ sessionId: incoming }: { sessionId: string }) => {
    if (incoming !== sessionId) return;
    callbacks.onEnded?.();
  };

  socket.on('call:ai:ready', onReady);
  socket.on('call:ai:agent_text', onAgentText);
  socket.on('call:ai:user_text', onUserText);
  socket.on('call:ai:error', onError);
  socket.on('call:ai:ended', onEnded);

  await ensureConnected();

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('AI call start timed out. Check backend socket handlers.'));
    }, START_TIMEOUT_MS);
    socket.emit('call:ai:start', { sessionId }, (ack: any) => {
      clearTimeout(timeout);
      if (ack?.ok) resolve();
      else reject(new Error(ack?.error ?? 'Unable to start AI call'));
    });
  });

  const sendText = (text: string) =>
    new Promise<void>((resolve, reject) => {
      socket.emit('call:ai:user_text', { sessionId, text }, (ack: any) => {
        if (ack?.ok) resolve();
        else reject(new Error(ack?.error ?? 'Unable to send text'));
      });
    });

  const stop = async () => {
    await new Promise<void>((resolve, reject) => {
      socket.emit('call:ai:stop', { sessionId }, (ack: any) => {
        if (ack?.ok) resolve();
        else reject(new Error(ack?.error ?? 'Unable to stop AI call'));
      });
    }).catch(() => {
      // Avoid throwing during navigation cleanup.
    });
    socket.off('call:ai:ready', onReady);
    socket.off('call:ai:agent_text', onAgentText);
    socket.off('call:ai:user_text', onUserText);
    socket.off('call:ai:error', onError);
    socket.off('call:ai:ended', onEnded);
  };

  return { sendText, stop };
}

