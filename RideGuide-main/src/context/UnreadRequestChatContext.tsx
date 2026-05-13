import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ChatMessage } from '../backend/types';
import {
  joinRequestChatRoom,
  leaveRequestChatRoom,
  subscribeChatMessages,
} from '../backend/chatService';
import { useAuth } from './AuthContext';
import { useOngoingActivity } from './OngoingActivityContext';

interface UnreadRequestChatContextValue {
  hasUnreadRequestChat: boolean;
  /** While RequestChat is visible for this request, incoming messages do not set unread. */
  setOpenRequestChatId: (id: string | null) => void;
  clearUnreadRequestChat: () => void;
}

const UnreadRequestChatContext = createContext<UnreadRequestChatContextValue | undefined>(undefined);

export const UnreadRequestChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { activity, focusedRouteName } = useOngoingActivity();
  const [hasUnread, setHasUnread] = useState(false);
  const openRequestChatIdRef = useRef<string | null>(null);
  const focusedRouteRef = useRef<string | undefined>(undefined);

  focusedRouteRef.current = focusedRouteName;

  const setOpenRequestChatId = useCallback((id: string | null) => {
    openRequestChatIdRef.current = id;
  }, []);

  const clearUnreadRequestChat = useCallback(() => {
    setHasUnread(false);
  }, []);

  useEffect(() => {
    if (!user?._id) return;
    const uid = String(user._id);
    const unsub = subscribeChatMessages((msg: ChatMessage) => {
      if (String(msg.senderId) === uid) return;
      if (focusedRouteRef.current === 'RequestChat' && openRequestChatIdRef.current === String(msg.requestId)) {
        return;
      }
      setHasUnread(true);
    });
    return unsub;
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id || !activity?.requestId) return;
    const id = activity.requestId;
    let cancelled = false;
    void (async () => {
      try {
        await joinRequestChatRoom(id);
      } catch {
        /* not a member yet or network */
      }
      if (cancelled) {
        void leaveRequestChatRoom(id).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
      void leaveRequestChatRoom(id).catch(() => {});
    };
  }, [user?._id, activity?.requestId]);

  const value = useMemo(
    () => ({
      hasUnreadRequestChat: hasUnread,
      setOpenRequestChatId,
      clearUnreadRequestChat,
    }),
    [hasUnread, setOpenRequestChatId, clearUnreadRequestChat]
  );

  return <UnreadRequestChatContext.Provider value={value}>{children}</UnreadRequestChatContext.Provider>;
};

export function useUnreadRequestChat(): UnreadRequestChatContextValue {
  const ctx = useContext(UnreadRequestChatContext);
  if (!ctx) throw new Error('useUnreadRequestChat must be used within UnreadRequestChatProvider');
  return ctx;
}
