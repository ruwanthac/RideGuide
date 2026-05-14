import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { getSocket } from '../backend/socketClient';
import { listServiceRequests, subscribeServiceRequests } from '../backend/serviceRequestsService';
import type { ServiceRequest, UserRole } from '../backend/types';

const STORAGE_KEY = 'rideguide_profile_notifications_v1';

export type ProfileNotificationSource = 'owner_accept' | 'provider_pool';

export type ProfileNotificationItem = {
  id: string;
  requestId: string;
  requestType: 'tow' | 'roadside';
  source: ProfileNotificationSource;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

type StoredPayload = {
  userId: string;
  role: UserRole;
  items: ProfileNotificationItem[];
};

function sortByCreatedDesc(a: ProfileNotificationItem, b: ProfileNotificationItem): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function isOwnerAcceptNotice(doc: ServiceRequest, ownerId: string): boolean {
  if (!doc?._id || !doc.acceptedBy) return false;
  if (String(doc.requesterId) !== String(ownerId)) return false;
  if (doc.status === 'cancelled') return false;
  if (doc.type === 'roadside') return doc.status !== 'pending';
  if (doc.type === 'tow') return doc.status !== 'requested';
  return false;
}

function buildOwnerAcceptItem(doc: ServiceRequest): ProfileNotificationItem {
  const provider =
    doc.acceptedProviderDisplayName?.trim() ||
    (doc.type === 'tow' ? 'Tow truck driver' : 'Mechanic');
  const title = doc.type === 'tow' ? 'Tow request accepted' : 'Roadside help accepted';
  const body = `${provider} accepted your request for ${doc.vehicle || 'your vehicle'}.`;
  const createdAt =
    (doc as { acceptedAt?: string | null }).acceptedAt?.toString?.() ||
    doc.updatedAt ||
    doc.createdAt ||
    new Date().toISOString();
  return {
    id: `${doc._id}-owner-accept`,
    requestId: doc._id,
    requestType: doc.type,
    source: 'owner_accept',
    title,
    body,
    createdAt,
    read: false,
  };
}

function buildProviderPoolItem(doc: ServiceRequest): ProfileNotificationItem {
  const title = doc.type === 'tow' ? 'New tow hire' : 'New roadside request';
  const snippet = (doc.issue || doc.location || '').trim();
  const body = `${doc.vehicle || 'Vehicle'}${snippet ? ` — ${snippet.slice(0, 120)}` : ''}`;
  const createdAt = doc.createdAt || doc.updatedAt || new Date().toISOString();
  return {
    id: `${doc._id}-pool`,
    requestId: doc._id,
    requestType: doc.type,
    source: 'provider_pool',
    title,
    body,
    createdAt,
    read: false,
  };
}

function mergeProviderPoolIntoItems(
  prev: ProfileNotificationItem[],
  pool: ServiceRequest[],
): ProfileNotificationItem[] {
  const poolIds = new Set(pool.map((p) => p._id));
  const kept = prev.filter((n) => n.source !== 'provider_pool' || poolIds.has(n.requestId));
  const byId = new Map(kept.map((n) => [n.id, { ...n }]));
  for (const doc of pool) {
    const built = buildProviderPoolItem(doc);
    const existing = prev.find((n) => n.id === built.id);
    byId.set(built.id, { ...built, read: existing?.read ?? false });
  }
  return Array.from(byId.values()).sort(sortByCreatedDesc);
}

function mergeOwnerAcceptDoc(prev: ProfileNotificationItem[], doc: ServiceRequest, ownerId: string): ProfileNotificationItem[] {
  if (!isOwnerAcceptNotice(doc, ownerId)) return prev;
  const built = buildOwnerAcceptItem(doc);
  const idx = prev.findIndex((p) => p.id === built.id);
  if (idx === -1) {
    return [{ ...built, read: false }, ...prev].sort(sortByCreatedDesc);
  }
  const existing = prev[idx];
  const merged = {
    ...built,
    read: existing.read,
  };
  if (
    existing.title === merged.title &&
    existing.body === merged.body &&
    existing.read === merged.read &&
    existing.createdAt === merged.createdAt
  ) {
    return prev;
  }
  const copy = [...prev];
  copy[idx] = merged;
  return copy.sort(sortByCreatedDesc);
}

interface ProfileNotificationsContextValue {
  items: ProfileNotificationItem[];
  hasUnread: boolean;
  markAllRead: () => void;
}

const ProfileNotificationsContext = createContext<ProfileNotificationsContextValue | undefined>(undefined);

export const ProfileNotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<ProfileNotificationItem[]>([]);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((next: ProfileNotificationItem[], userId: string, role: UserRole) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      void (async () => {
        try {
          const payload: StoredPayload = { userId, role, items: next };
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
          /* ignore */
        }
      })();
    }, 250);
  }, []);

  const markAllRead = useCallback(() => {
    if (!user?._id) return;
    setItems((prev) => {
      if (!prev.some((p) => !p.read)) return prev;
      return prev.map((p) => ({ ...p, read: true }));
    });
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) {
      setItems([]);
      return;
    }
    if (user.role === 'admin') {
      setItems([]);
      return;
    }
    const uid = String(user._id);
    const role = user.role as UserRole;
    let cancelled = false;
    void (async () => {
      let next: ProfileNotificationItem[] = [];
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as StoredPayload;
          if (parsed?.userId === uid && parsed?.role === role && Array.isArray(parsed.items)) {
            next = parsed.items;
          } else {
            await AsyncStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        next = [];
      }
      if (cancelled) return;
      if (role === 'owner') {
        try {
          const rows = await listServiceRequests();
          if (cancelled) return;
          for (const doc of rows) {
            next = mergeOwnerAcceptDoc(next, doc, uid);
          }
        } catch {
          /* offline */
        }
      }
      if (!cancelled) setItems(next.sort(sortByCreatedDesc));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.role]);

  useEffect(() => {
    if (!user?._id || user.role !== 'owner') return;
    const ownerId = String(user._id);
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        const socket = await getSocket();
        if (cancelled) return;
        const onUpdated = (doc: ServiceRequest) => {
          if (String(doc.requesterId) !== ownerId) return;
          setItems((prev) => mergeOwnerAcceptDoc(prev, doc, ownerId));
        };
        socket.on('request:updated', onUpdated);
        cleanup = () => socket.off('request:updated', onUpdated);
      } catch {
        /* no socket */
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [user?._id, user?.role]);

  useEffect(() => {
    if (user?.role === 'mechanic' && user.mechanicAvailable === false) {
      setItems((prev) => prev.filter((p) => p.source !== 'provider_pool'));
      return;
    }
    if (user?.role === 'tow' && user.towAvailable === false) {
      setItems((prev) => prev.filter((p) => p.source !== 'provider_pool'));
      return;
    }
  }, [user?.role, user?.mechanicAvailable, user?.towAvailable]);

  useEffect(() => {
    if (!user?._id || (user.role !== 'mechanic' && user.role !== 'tow')) return;
    if (user.role === 'mechanic' && user.mechanicAvailable === false) return;
    if (user.role === 'tow' && user.towAvailable === false) return;

    const filter =
      user.role === 'mechanic'
        ? { type: 'roadside' as const, inboxOnly: true as const, providerOpenPoolOnly: true as const }
        : { type: 'tow' as const, inboxOnly: true as const, providerOpenPoolOnly: true as const };

    let alive = true;
    let unsub: (() => void) | undefined;

    void (async () => {
      try {
        const off = await subscribeServiceRequests((pool) => {
          if (!alive) return;
          setItems((prev) => mergeProviderPoolIntoItems(prev, pool));
        }, filter);
        unsub = off;
      } catch {
        /* ignore */
      }
    })();

    return () => {
      alive = false;
      unsub?.();
    };
  }, [user?._id, user?.role, user?.mechanicAvailable, user?.towAvailable]);

  useEffect(() => {
    if (!user?._id || user.role === 'admin') return;
    const uid = String(user._id);
    const role = user.role as UserRole;
    persist(items, uid, role);
  }, [items, persist, user?._id, user?.role]);

  const hasUnread = useMemo(() => items.some((i) => !i.read), [items]);

  const value = useMemo(
    () => ({
      items,
      hasUnread,
      markAllRead,
    }),
    [items, hasUnread, markAllRead],
  );

  return <ProfileNotificationsContext.Provider value={value}>{children}</ProfileNotificationsContext.Provider>;
};

export function useProfileNotifications(): ProfileNotificationsContextValue {
  const ctx = useContext(ProfileNotificationsContext);
  if (!ctx) throw new Error('useProfileNotifications must be used within ProfileNotificationsProvider');
  return ctx;
}
