import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { adminUrl, apiGet } from '../lib/api';

export const COUNTS_CHANGED_EVENT = 'rideguide:counts-changed';

/** Tell the sidebar badges to reload (after approving or rejecting an application, etc.). */
export function notifyCountsChanged() {
  window.dispatchEvent(new Event(COUNTS_CHANGED_EVENT));
}

/** Waiting applications and unclaimed requests, for the sidebar badges. Refreshes on navigation. */
export function useAttentionCounts() {
  const { pathname } = useLocation();
  const [counts, setCounts] = useState<{ applications: number; waitingRequests: number }>({ applications: 0, waitingRequests: 0 });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(COUNTS_CHANGED_EVENT, bump);
    const id = window.setInterval(bump, 60_000);
    return () => {
      window.removeEventListener(COUNTS_CHANGED_EVENT, bump);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ pendingApplications?: number; waitingRequests?: number }>(adminUrl('stats'))
      .then((s) => {
        if (!cancelled) setCounts({ applications: s.pendingApplications ?? 0, waitingRequests: s.waitingRequests ?? 0 });
      })
      .catch(() => {
        /* badges are a hint; keep the last value */
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, tick]);

  return counts;
}
