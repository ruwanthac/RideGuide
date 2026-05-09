import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { NavigationState } from '@react-navigation/native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { listServiceRequests } from '../backend/serviceRequestsService';
import type { AuthUser, ServiceRequest, UserRole } from '../backend/types';
import { useAuth } from './AuthContext';
import type { HomeStackParamList, RootStackParamList } from '../types/navigation';

export type OngoingActivityKind =
  | 'tow_owner'
  | 'roadside_owner'
  | 'tow_driver'
  | 'mechanic';

export interface OngoingActivitySnapshot {
  kind: OngoingActivityKind;
  requestId: string;
  title: string;
  subtitle: string;
  cancelEligible: boolean;
  navigateScreen: keyof Pick<
    HomeStackParamList,
    'TowOwnerTracking' | 'RoadsideOwnerTracking' | 'TowDriverActiveJob' | 'MechanicActiveJob'
  >;
  /** ISO string — for picking newest concurrent job */
  updatedAt: string;
}

function terminalStatus(status: ServiceRequest['status']): boolean {
  return status === 'completed' || status === 'cancelled';
}

function ownerRoadsideOngoing(status: ServiceRequest['status']): boolean {
  return status === 'pending' || status === 'accepted' || status === 'attending_to_location';
}

function ownerTowOngoing(status: ServiceRequest['status']): boolean {
  return (
    status === 'requested' ||
    status === 'driver_picked_hire' ||
    status === 'driver_on_the_way' ||
    status === 'driver_arrived' ||
    status === 'vehicle_in_tow'
  );
}

function mechanicOngoing(status: ServiceRequest['status']): boolean {
  return status === 'accepted' || status === 'attending_to_location';
}

function towDriverOngoing(status: ServiceRequest['status']): boolean {
  return (
    status === 'driver_picked_hire' ||
    status === 'driver_on_the_way' ||
    status === 'driver_arrived' ||
    status === 'vehicle_in_tow'
  );
}

function ownerTowCancelEligible(r: ServiceRequest): boolean {
  return r.type === 'tow' && r.status === 'requested';
}

function ownerRoadsideCancelEligible(r: ServiceRequest): boolean {
  return r.type === 'roadside' && r.status === 'pending';
}

function pickOwnerActivity(rows: ServiceRequest[]): OngoingActivitySnapshot | null {
  const active = rows.filter((r) =>
    r.type === 'tow' ? ownerTowOngoing(r.status) : ownerRoadsideOngoing(r.status)
  );
  const roads = active.filter((r) => r.type === 'roadside').sort(byUpdatedDesc)[0];
  const tows = active.filter((r) => r.type === 'tow').sort(byUpdatedDesc)[0];
  if (!roads && !tows) return null;
  if (!roads)
    return {
      kind: 'tow_owner',
      requestId: tows._id,
      title: 'Tow in progress',
      subtitle: tows.pickupAddress || tows.dropoffAddress || tows.issue || '',
      cancelEligible: ownerTowCancelEligible(tows),
      navigateScreen: 'TowOwnerTracking',
      updatedAt: tows.updatedAt,
    };
  if (!tows)
    return {
      kind: 'roadside_owner',
      requestId: roads._id,
      title: 'Roadside help',
      subtitle: roads.pickupAddress || roads.issue || roads.location,
      cancelEligible: ownerRoadsideCancelEligible(roads),
      navigateScreen: 'RoadsideOwnerTracking',
      updatedAt: roads.updatedAt,
    };
  const newer = new Date(tows.updatedAt).getTime() >= new Date(roads.updatedAt).getTime()
    ? tows
    : roads;
  if (newer.type === 'tow') {
    return {
      kind: 'tow_owner',
      requestId: newer._id,
      title: 'Tow in progress',
      subtitle: newer.pickupAddress || newer.dropoffAddress || newer.issue || '',
      cancelEligible: ownerTowCancelEligible(newer),
      navigateScreen: 'TowOwnerTracking',
      updatedAt: newer.updatedAt,
    };
  }
  return {
    kind: 'roadside_owner',
    requestId: newer._id,
    title: 'Roadside help',
    subtitle: newer.pickupAddress || newer.issue || newer.location,
    cancelEligible: ownerRoadsideCancelEligible(newer),
    navigateScreen: 'RoadsideOwnerTracking',
    updatedAt: newer.updatedAt,
  };
}

function byUpdatedDesc(a: ServiceRequest, b: ServiceRequest) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function idEquals(a: unknown, b: unknown): boolean {
  const left = String((a as any)?._id ?? a ?? '');
  const right = String((b as any)?._id ?? b ?? '');
  return left.length > 0 && right.length > 0 && left === right;
}

/** Avoid `{ ...prev, id: true }` when already set — new object triggers re-renders and sync loops. */
function dismissRequest(prev: Record<string, true>, requestId: string): Record<string, true> {
  if (!requestId || prev[requestId]) return prev;
  return { ...prev, [requestId]: true };
}

function pickTowDriverActivity(rows: ServiceRequest[], userId: string): OngoingActivitySnapshot | null {
  const active = rows
    .filter((r) => r.type === 'tow' && towDriverOngoing(r.status))
    .filter((r) => idEquals(r.acceptedBy, userId));
  const best = active.sort(byUpdatedDesc)[0];
  if (!best) return null;
  return {
    kind: 'tow_driver',
    requestId: best._id,
    title: 'Tow job',
    subtitle: best.userName ? `${best.userName} · ${best.vehicle}` : best.vehicle,
    cancelEligible: false,
    navigateScreen: 'TowDriverActiveJob',
    updatedAt: best.updatedAt,
  };
}

function pickMechanicActivity(rows: ServiceRequest[], userId: string): OngoingActivitySnapshot | null {
  const active = rows
    .filter((r) => r.type === 'roadside' && mechanicOngoing(r.status))
    .filter((r) => idEquals(r.acceptedBy, userId));
  const best = active.sort(byUpdatedDesc)[0];
  if (!best) return null;
  return {
    kind: 'mechanic',
    requestId: best._id,
    title: 'Roadside job',
    subtitle: best.userName ? `${best.userName} · ${best.vehicle}` : best.vehicle,
    cancelEligible: false,
    navigateScreen: 'MechanicActiveJob',
    updatedAt: best.updatedAt,
  };
}

function snapshotFromRequestForOwner(r: ServiceRequest): OngoingActivitySnapshot {
  if (r.type === 'tow') {
    return {
      kind: 'tow_owner',
      requestId: r._id,
      title: 'Tow in progress',
      subtitle: r.pickupAddress || r.dropoffAddress || r.issue || '',
      cancelEligible: ownerTowCancelEligible(r),
      navigateScreen: 'TowOwnerTracking',
      updatedAt: r.updatedAt,
    };
  }
  return {
    kind: 'roadside_owner',
    requestId: r._id,
    title: 'Roadside help',
    subtitle: r.pickupAddress || r.issue || r.location,
    cancelEligible: ownerRoadsideCancelEligible(r),
    navigateScreen: 'RoadsideOwnerTracking',
    updatedAt: r.updatedAt,
  };
}

function snapshotFromRequestForTowDriver(r: ServiceRequest): OngoingActivitySnapshot {
  return {
    kind: 'tow_driver',
    requestId: r._id,
    title: 'Tow job',
    subtitle: r.userName ? `${r.userName} · ${r.vehicle}` : r.vehicle,
    cancelEligible: false,
    navigateScreen: 'TowDriverActiveJob',
    updatedAt: r.updatedAt,
  };
}

function snapshotFromRequestForMechanic(r: ServiceRequest): OngoingActivitySnapshot {
  return {
    kind: 'mechanic',
    requestId: r._id,
    title: 'Roadside job',
    subtitle: r.userName ? `${r.userName} · ${r.vehicle}` : r.vehicle,
    cancelEligible: false,
    navigateScreen: 'MechanicActiveJob',
    updatedAt: r.updatedAt,
  };
}

async function hydrateActivity(
  user: Pick<AuthUser, '_id' | 'role'>
): Promise<OngoingActivitySnapshot | null> {
  const uid = user._id;
  const role = user.role;

  try {
    if (role === 'owner') {
      // Owner bubble should reflect any active activity across profile/home/history,
      // not only the currently selected garage vehicle.
      const rows = await listServiceRequests();
      return pickOwnerActivity(rows);
    }
    if (role === 'tow') {
      const rows = await listServiceRequests();
      return pickTowDriverActivity(rows, uid);
    }
    if (role === 'mechanic') {
      const rows = await listServiceRequests();
      return pickMechanicActivity(rows, uid);
    }
  } catch {
    return null;
  }
  return null;
}

function getDeepestRouteName(state: NavigationState | undefined): string | undefined {
  if (!state || state.routes.length === 0) return undefined;
  const route = state.routes[state.index];
  if (route.state) {
    const nested = getDeepestRouteName(route.state as NavigationState);
    return nested ?? route.name;
  }
  return route.name;
}

interface OngoingActivityContextValue {
  activity: OngoingActivitySnapshot | null;
  /** Route name at deepest level (e.g. TowOwnerTracking) */
  focusedRouteName: string | undefined;
  setActivity: (next: OngoingActivitySnapshot | null) => void;
  syncFromServiceRequest: (r: ServiceRequest, role: UserRole) => void;
  clearForRequest: (requestId: string) => void;
  clearAll: () => void;
  refreshHydration: () => Promise<void>;
  navigateToActivity: () => void;
}

const OngoingActivityContext = createContext<OngoingActivityContextValue | undefined>(undefined);

export const OngoingActivityProvider: React.FC<{
  children: React.ReactNode;
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
}> = ({ children, navigationRef }) => {
  const { user, authReady } = useAuth();
  const [activity, setActivity] = useState<OngoingActivitySnapshot | null>(null);
  const hydrationInFlightRef = useRef(false);
  const [focusedRouteName, setFocusedRouteName] = useState<string | undefined>(undefined);
  const [dismissedRequestIds, setDismissedRequestIds] = useState<Record<string, true>>({});

  const updateFocusedRoute = useCallback(() => {
    try {
      const root = navigationRef.getRootState();
      setFocusedRouteName(getDeepestRouteName(root));
    } catch {
      /* ref not mounted */
    }
  }, [navigationRef]);

  useEffect(() => {
    updateFocusedRoute();
    const unsub = navigationRef.addListener('state', updateFocusedRoute);
    return unsub;
  }, [navigationRef, updateFocusedRoute]);

  const clearAll = useCallback(() => {
    setActivity((prev) => (prev === null ? prev : null));
    setDismissedRequestIds((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }, []);

  const clearForRequest = useCallback((requestId: string) => {
    setActivity((prev) => (prev?.requestId === requestId ? null : prev));
    if (requestId) {
      setDismissedRequestIds((prev) => dismissRequest(prev, requestId));
    }
  }, []);

  const syncFromServiceRequest = useCallback(
    (r: ServiceRequest, role: UserRole) => {
      const uid = user?._id;
      if (terminalStatus(r.status)) {
        setActivity((prev) => (prev?.requestId === r._id ? null : prev));
        setDismissedRequestIds((prev) => dismissRequest(prev, r._id));
        return;
      }
      if (dismissedRequestIds[r._id]) return;
      if (role === 'owner') {
        const ownerAllowed =
          r.type === 'tow' ? ownerTowOngoing(r.status) : ownerRoadsideOngoing(r.status);
        if (!ownerAllowed) {
          setActivity((prev) => (prev?.requestId === r._id ? null : prev));
          return;
        }
        setActivity(snapshotFromRequestForOwner(r));
        return;
      }
      if (role === 'tow' && r.type === 'tow') {
        if (!uid || !idEquals(r.acceptedBy, uid)) return;
        if (!towDriverOngoing(r.status)) {
          setActivity((prev) => (prev?.requestId === r._id ? null : prev));
          return;
        }
        setActivity(snapshotFromRequestForTowDriver(r));
        return;
      }
      if (role === 'mechanic' && r.type === 'roadside') {
        if (!uid || !idEquals(r.acceptedBy, uid)) return;
        if (!mechanicOngoing(r.status)) {
          setActivity((prev) => (prev?.requestId === r._id ? null : prev));
          return;
        }
        setActivity(snapshotFromRequestForMechanic(r));
      }
    },
    [dismissedRequestIds, user?._id],
  );

  const navigateToActivity = useCallback(() => {
    const snap = activity;
    if (!snap || !navigationRef.isReady()) return;
    navigationRef.navigate('Main', {
      screen: 'HomeTab',
      params: {
        screen: snap.navigateScreen,
        params: { requestId: snap.requestId },
      },
    });
  }, [activity, navigationRef]);

  const refreshHydration = useCallback(async () => {
    if (!user || user.role === 'admin') {
      setActivity(null);
      return;
    }
    if (hydrationInFlightRef.current) return;
    hydrationInFlightRef.current = true;
    try {
      const next = await hydrateActivity({ _id: user._id, role: user.role });
      if (next && dismissedRequestIds[next.requestId]) {
        setActivity(null);
        return;
      }
      setActivity(next);
    } finally {
      hydrationInFlightRef.current = false;
    }
  }, [dismissedRequestIds, user?._id, user?.role]);

  useEffect(() => {
    if (!authReady || !user) {
      clearAll();
      return;
    }
    void refreshHydration();
  }, [authReady, user?._id, user?.role, refreshHydration, clearAll]);

  useEffect(() => {
    if (!authReady || !user) return;
    const interval = setInterval(() => {
      void refreshHydration();
    }, 25000);
    return () => clearInterval(interval);
  }, [authReady, refreshHydration, user?._id, user?.role]);

  const value = useMemo<OngoingActivityContextValue>(
    () => ({
      activity,
      focusedRouteName,
      setActivity,
      syncFromServiceRequest,
      clearForRequest,
      clearAll,
      refreshHydration,
      navigateToActivity,
    }),
    [
      activity,
      focusedRouteName,
      syncFromServiceRequest,
      clearForRequest,
      clearAll,
      refreshHydration,
      navigateToActivity,
    ]
  );

  return <OngoingActivityContext.Provider value={value}>{children}</OngoingActivityContext.Provider>;
};

export function useOngoingActivity(): OngoingActivityContextValue {
  const ctx = useContext(OngoingActivityContext);
  if (!ctx) throw new Error('useOngoingActivity must be used within OngoingActivityProvider');
  return ctx;
}
