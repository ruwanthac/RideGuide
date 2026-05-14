import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { TableSkeleton } from '../components/ui/Skeleton';
import { adminUrl, apiGet, ApiError } from '../lib/api';

interface AnalyticsApi {
  range: { days: number; since: string };
  requestsByType: { type: string; count: number }[];
  requestsByStatus: { status: string; count: number }[];
  requestsPerDay: { date: string; count: number }[];
  completedRequestsInRange: number;
  diagnosesInRange: number;
  acceptanceTimeAvgMinutes: { roadside: number | null; tow: number | null };
  acceptanceSamples: { roadside: number; tow: number };
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#64748b'];

export function Analytics() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<AnalyticsApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<AnalyticsApi>(adminUrl(`analytics?days=${days}`));
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof ApiError ? e.message : 'Failed to load analytics');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const perDayChart = useMemo(
    () => (data?.requestsPerDay ?? []).map((d) => ({ name: d.date, count: d.count })),
    [data]
  );

  const typePie = useMemo(
    () =>
      (data?.requestsByType ?? []).map((t) => ({
        name: String(t.type ?? 'unknown'),
        value: Number(t.count ?? 0),
      })),
    [data]
  );

  const statusBar = useMemo(
    () =>
      (data?.requestsByStatus ?? []).map((s) => ({
        name: String(s.status ?? '—'),
        count: Number(s.count ?? 0),
      })),
    [data]
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-10" />
        <TableSkeleton rows={3} cols={3} />
        <TableSkeleton rows={3} cols={1} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 text-sm text-red-800 dark:text-red-200">
        {error ?? 'Unable to load analytics.'}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Aggregates from the RideGuide API (rate-limited)
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Range (days)</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            {[7, 14, 30, 60, 90, 180, 365].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Window: last {data.range.days} days (since {new Date(data.range.since).toLocaleDateString()}).
      </p>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg tow accept time</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {data.acceptanceTimeAvgMinutes.tow != null ? `${data.acceptanceTimeAvgMinutes.tow.toFixed(1)} min` : '—'}
            </p>
            <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
              Samples: {data.acceptanceSamples.tow}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg roadside accept time</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {data.acceptanceTimeAvgMinutes.roadside != null
                ? `${data.acceptanceTimeAvgMinutes.roadside.toFixed(1)} min`
                : '—'}
            </p>
            <p className="mt-0.5 text-xs text-sky-600 dark:text-sky-400">
              Samples: {data.acceptanceSamples.roadside}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed requests</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{data.completedRequestsInRange}</p>
            <p className="mt-0.5 text-xs text-accent-600 dark:text-accent-400">In selected window</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Diagnosis records</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{data.diagnosesInRange}</p>
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">DiagnosisHistory in range</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Requests per day" subtitle="All service requests in window" />
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perDayChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="name" className="text-xs" stroke="currentColor" angle={-35} textAnchor="end" height={60} />
                <YAxis className="text-xs" stroke="currentColor" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg)',
                  }}
                />
                <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Requests by type" subtitle="Share in window" />
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typePie.length ? typePie : [{ name: 'none', value: 1 }]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(typePie.length ? typePie : [{ name: 'none', value: 1 }]).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(value: number) => [value, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Requests by status" subtitle="Counts in window" />
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBar} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis type="number" className="text-xs" stroke="currentColor" />
                  <YAxis type="category" dataKey="name" className="text-xs" stroke="currentColor" width={72} />
                  <Tooltip contentStyle={{ borderRadius: '12px' }} />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
