import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { listServiceRequests } from '../backend/serviceRequestsService';
import type { ServiceRequest } from '../backend/types';

/** When a finished job was completed (the server bumps `updatedAt` on the final status change). */
export function completedAt(job: ServiceRequest): Date {
  return new Date(job.updatedAt ?? job.createdAt);
}

export function isSameMonth(d: Date, year: number, month: number): boolean {
  return d.getFullYear() === year && d.getMonth() === month;
}

/**
 * Jobs this mechanic or tow driver finished, newest first. Reloads when the screen regains focus
 * and whenever `refreshKey` changes. `jobs` is null until the first load finishes.
 */
export function useCompletedJobs(type: ServiceRequest['type'], refreshKey = 0) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ServiceRequest[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!user?._id) return;
    try {
      const rows = await listServiceRequests({ history: true });
      const mine = rows
        .filter((r) => r.type === type && r.status === 'completed' && String(r.acceptedBy ?? '') === String(user._id))
        .sort((a, b) => completedAt(b).getTime() - completedAt(a).getTime());
      setJobs(mine);
      setError(false);
    } catch {
      // Keep whatever we showed last; flag it so screens can say so when they have nothing.
      setError(true);
    }
  }, [user?._id, type]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return { jobs, error, reload: load };
}
