import { useState, useEffect, useMemo } from 'react';
import { Users, Wrench, Truck, ClipboardList, Car, AlertCircle } from 'lucide-react';
import {
  LineChart,
  Line,
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
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { CardSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { adminUrl, apiGet, ApiError } from '../lib/api';
import type { Activity, ChartDataPoint } from '../types';

const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#a855f7'];

interface StatsPayload {
  userCount: number;
  vehicleCount: number;
  requestCount: number;
  pendingCount: number;
  requestsToday: number;
  activeMechanics: number;
  activeTowDrivers: number;
}

interface Analytics7d {
  requestsPerDay: { date: string; count: number }[];
  requestsByType: { type: string; count: number }[];
  diagnosesInRange: number;
}

interface RecentReq {
  id: string;
  type?: string;
  status?: string;
  issue?: string;
  userName?: string;
  createdAt?: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [analytics, setAnalytics] = useState<Analytics7d | null>(null);
  const [recent, setRecent] = useState<RecentReq[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, a, r] = await Promise.all([
          apiGet<StatsPayload>(adminUrl('stats')),
          apiGet<Analytics7d>(adminUrl('analytics?days=7')),
          apiGet<{ items: RecentReq[] }>(adminUrl('requests?page=1&limit=10')),
        ]);
        if (!cancelled) {
          setStats(s);
          setAnalytics(a);
          setRecent(Array.isArray(r.items) ? r.items : []);
        }
      } catch (e) {
        if (!cancelled) {
          setStats(null);
          setAnalytics(null);
          setRecent([]);
          setError(e instanceof ApiError ? e.message : 'Failed to load dashboard');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lineData = useMemo(() => {
    const rows = analytics?.requestsPerDay ?? [];
    return rows.map((d) => ({ name: d.date, requests: d.count }));
  }, [analytics]);

  const pieData = useMemo((): ChartDataPoint[] => {
    const byType = analytics?.requestsByType ?? [];
    const out: ChartDataPoint[] = byType.map((t) => ({
      name: String(t.type ?? 'unknown'),
      value: Number(t.count ?? 0),
    }));
    const dx = analytics?.diagnosesInRange ?? 0;
    if (dx > 0) {
      out.push({ name: 'Diagnoses (7d)', value: dx });
    }
    return out.length ? out : [{ name: 'No data', value: 1 }];
  }, [analytics]);

  const recentActivity: Activity[] = useMemo(() => {
    return recent.map((req) => {
      const id = String(req.id ?? (req as { _id?: string })._id ?? '');
      const type = req.type ?? '—';
      const status = req.status ?? '—';
      const issue = (req.issue ?? '').slice(0, 80);
      return {
        id,
        type: 'request',
        description: `${type} · ${status}${issue ? ` — ${issue}` : ''}`,
        user: req.userName,
        timestamp: req.createdAt ?? new Date().toISOString(),
      };
    });
  }, [recent]);

  const kpis = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Users', value: stats.userCount, icon: Users, color: 'text-accent-600 dark:text-accent-400' },
      { label: 'Vehicles', value: stats.vehicleCount, icon: Car, color: 'text-sky-600 dark:text-sky-400' },
      { label: 'Requests (roadside + tow)', value: stats.requestCount, icon: ClipboardList, color: 'text-violet-600 dark:text-violet-400' },
      { label: 'Pending requests', value: stats.pendingCount, icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400' },
      { label: 'Requests today', value: stats.requestsToday, icon: ClipboardList, color: 'text-indigo-600 dark:text-indigo-400' },
      { label: 'Active mechanics', value: stats.activeMechanics, icon: Wrench, color: 'text-emerald-600 dark:text-emerald-400' },
      { label: 'Active tow drivers', value: stats.activeTowDrivers, icon: Truck, color: 'text-orange-600 dark:text-orange-400' },
    ];
  }, [stats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-16" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={4} cols={3} />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 text-sm text-red-800 dark:text-red-200">
        {error ?? 'Unable to load dashboard.'}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of your vehicle diagnosis & roadside assistance platform
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="transition-all duration-300 hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{kpi.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{kpi.value}</p>
                  </div>
                  <div className={`rounded-xl bg-gray-100 dark:bg-gray-800 p-3 ${kpi.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Requests (last 7 days)" subtitle="Daily volume from analytics API" />
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis dataKey="name" className="text-xs" stroke="currentColor" />
                  <YAxis className="text-xs" stroke="currentColor" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={{ fill: '#0ea5e9' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Request distribution (7d)" subtitle="By type + diagnoses in range" />
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip
                    formatter={(value: number) => [value, 'Count']}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent activity" subtitle="Latest roadside & tow requests" />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableHead>Description</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Time</TableHead>
            </TableHeader>
            <TableBody>
              {recentActivity.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-gray-500">
                    No recent requests
                  </TableCell>
                </TableRow>
              ) : (
                recentActivity.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.description}</TableCell>
                    <TableCell>{a.user ?? '—'}</TableCell>
                    <TableCell className="text-gray-500 dark:text-gray-400">{formatTime(a.timestamp)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
