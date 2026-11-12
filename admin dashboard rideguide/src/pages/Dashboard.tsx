import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, Radio, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { CardSkeleton } from '../components/ui/Skeleton';
import { requestStatusLabel, statusToBadgeVariant } from '../components/ui/badgeStatus';
import { adminUrl, apiGet, ApiError, fetchCurrentUser } from '../lib/api';

interface StatsPayload {
  userCount: number;
  vehicleCount: number;
  requestsToday: number;
  requestsYesterday?: number;
  activeMechanics: number;
  activeTowDrivers: number;
  newUsersThisWeek?: number;
  waitingRequests?: number;
  oldestWaitingRequest?: { userName: string; type: string; issue: string; createdAt?: string } | null;
  pendingApplications?: number;
  oldestPendingApplication?: { displayName: string; submittedAt?: string } | null;
}

interface Analytics7d {
  requestsPerDayByType?: { date: string; roadside: number; tow: number }[];
  completedRequestsInRange: number;
  diagnosesInRange: number;
  acceptanceTimeAvgMinutes?: { roadside: number | null; tow: number | null };
  acceptanceSamples?: { roadside: number; tow: number };
}

interface RecentReq {
  id?: string;
  _id?: string;
  type?: string;
  status?: string;
  issue?: string;
  userName?: string;
  location?: string;
  pickupAddress?: string;
  acceptedProviderDisplayName?: string | null;
  createdAt?: string;
}

function ago(iso?: string): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function minutesLabel(m: number | null): string {
  if (m == null || !Number.isFinite(m)) return '—';
  if (m < 1) return '<1 min';
  if (m < 60) return `${m.toFixed(1)} min`;
  return `${Math.floor(m / 60)} h ${Math.round(m % 60)} m`;
}

/** Last 7 days (oldest first) keyed like the API's UTC `YYYY-MM-DD` buckets. */
function last7Days(rows: { date: string; roadside: number; tow: number }[]) {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: { key: string; label: string; roadside: number; tow: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const r = byDate.get(key);
    out.push({
      key,
      label: i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' }),
      roadside: r?.roadside ?? 0,
      tow: r?.tow ?? 0,
    });
  }
  return out;
}

const tone = {
  red: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200',
  amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200',
  plain: 'border-slate-200 bg-white text-slate-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [analytics, setAnalytics] = useState<Analytics7d | null>(null);
  const [recent, setRecent] = useState<RecentReq[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetchCurrentUser()
      .then((u) => !cancelled && setName((u.displayName ?? '').trim().split(/\s+/)[0] ?? ''))
      .catch(() => {});
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, a, r] = await Promise.all([
          apiGet<StatsPayload>(adminUrl('stats')),
          apiGet<Analytics7d>(adminUrl('analytics?days=7')),
          apiGet<{ items: RecentReq[] }>(adminUrl('requests?page=1&limit=8')),
        ]);
        if (!cancelled) {
          setStats(s);
          setAnalytics(a);
          setRecent(Array.isArray(r.items) ? r.items : []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'We couldn’t load the dashboard. Please refresh the page.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const days = useMemo(() => last7Days(analytics?.requestsPerDayByType ?? []), [analytics]);
  const today = days[days.length - 1];

  const avgAccept = useMemo(() => {
    const m = analytics?.acceptanceTimeAvgMinutes;
    const n = analytics?.acceptanceSamples;
    if (!m || !n) return { all: null as number | null, roadside: null as number | null, tow: null as number | null };
    const parts = [
      { v: m.roadside, n: n.roadside },
      { v: m.tow, n: n.tow },
    ].filter((p) => p.v != null && p.n > 0) as { v: number; n: number }[];
    const total = parts.reduce((s, p) => s + p.n, 0);
    return { all: total ? parts.reduce((s, p) => s + p.v * p.n, 0) / total : null, roadside: m.roadside, tow: m.tow };
  }, [analytics]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-14" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        {error ?? 'We couldn’t load the dashboard. Please refresh the page.'}
      </div>
    );
  }

  const apps = stats.pendingApplications ?? 0;
  const waiting = stats.waitingRequests ?? 0;
  const oldestReq = stats.oldestWaitingRequest;
  const online = stats.activeMechanics + stats.activeTowDrivers;
  const nobodyOnline = stats.activeMechanics === 0 || stats.activeTowDrivers === 0;

  const attention = [
    {
      to: '/provider-applications',
      icon: ShieldCheck,
      title: apps ? `${apps} provider application${apps === 1 ? '' : 's'}` : 'No applications waiting',
      sub: apps && stats.oldestPendingApplication?.submittedAt ? `Oldest waiting ${ago(stats.oldestPendingApplication.submittedAt)}` : 'Everyone has been reviewed',
      cls: apps ? tone.red : tone.plain,
    },
    {
      to: oldestReq?.type === 'tow' ? '/requests/tow' : '/requests',
      icon: Clock,
      title: waiting ? `${waiting} request${waiting === 1 ? '' : 's'} waiting for a provider` : 'No one is waiting',
      sub: waiting && oldestReq ? `${oldestReq.userName || 'A driver'} has waited ${ago(oldestReq.createdAt)}` : 'Every open request has been taken',
      cls: waiting ? tone.amber : tone.plain,
    },
    {
      to: '/users?role=mechanic',
      icon: Radio,
      title: online ? `${online} provider${online === 1 ? '' : 's'} online` : 'No providers online',
      sub:
        stats.activeMechanics === 0
          ? 'No mechanics online right now'
          : stats.activeTowDrivers === 0
          ? 'No tow drivers online right now'
          : `${stats.activeMechanics} mechanic${stats.activeMechanics === 1 ? '' : 's'} · ${stats.activeTowDrivers} tow`,
      cls: nobodyOnline ? tone.red : tone.green,
    },
  ];

  const yesterday = stats.requestsYesterday ?? null;
  const delta = yesterday == null ? null : stats.requestsToday - yesterday;
  const kpis = [
    {
      label: 'Requests today',
      value: String(stats.requestsToday),
      delta: delta == null || delta === 0 ? null : { up: delta > 0, text: `${delta > 0 ? '+' : ''}${delta} vs yesterday`, good: true },
      sub: `${today.roadside} roadside · ${today.tow} tow`,
    },
    {
      label: 'Avg. time to accept',
      value: minutesLabel(avgAccept.all),
      delta: null,
      sub: `Last 7 days · roadside ${minutesLabel(avgAccept.roadside)} · tow ${minutesLabel(avgAccept.tow)}`,
    },
    {
      label: 'Jobs finished',
      value: String(analytics?.completedRequestsInRange ?? 0),
      delta: null,
      sub: `Last 7 days · ${analytics?.diagnosesInRange ?? 0} AI diagnoses`,
    },
    {
      label: 'Users',
      value: String(stats.userCount),
      delta: stats.newUsersThisWeek ? { up: true, text: `+${stats.newUsersThisWeek} this week`, good: true } : null,
      sub: `${stats.vehicleCount} vehicles registered`,
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {greeting()}
          {name ? `, ${name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · here is what needs you today
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {attention.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.title} to={a.to} className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-shadow hover:shadow-md ${a.cls}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/90 dark:bg-white/10">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{a.title}</span>
                <span className="block truncate text-xs opacity-80">{a.sub}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-sm font-medium text-slate-500 dark:text-gray-400">{k.label}</p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <span className="text-[28px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-white">{k.value}</span>
              {k.delta && (
                <span className={`inline-flex items-center text-xs font-bold ${k.delta.up ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
                  {k.delta.up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {k.delta.text}
                </span>
              )}
            </p>
            <p className="mt-2 text-xs text-slate-400 dark:text-gray-500">{k.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Requests, last 7 days</h2>
            <span className="flex gap-3 text-xs text-slate-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-accent-500" />
                Roadside
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                Tow
              </span>
            </span>
          </div>
          <div className="mt-4 min-h-72 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 13 }} />
                <Bar dataKey="roadside" name="Roadside" stackId="r" fill="#2563EB" />
                <Bar dataKey="tow" name="Tow" stackId="r" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Latest requests</h2>
            <Link to="/requests" className="text-sm font-bold text-accent-500 hover:text-accent-600">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] table-fixed text-left text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                <tr>
                  <th className="w-[24%] px-5 py-2.5">Driver</th>
                  <th className="w-[22%] px-3 py-2.5">Issue</th>
                  <th className="w-[18%] px-3 py-2.5">Where</th>
                  <th className="w-[18%] px-3 py-2.5">Provider</th>
                  <th className="w-[18%] px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      No requests yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((r) => {
                    const waitingNow = r.status === 'pending' || r.status === 'requested';
                    return (
                      <tr key={String(r.id ?? r._id)} className="text-slate-700 dark:text-gray-200">
                        <td className="px-5 py-3">
                          <span className="block truncate font-semibold text-slate-900 dark:text-white">{r.userName || '—'}</span>
                          <span className="block text-xs text-slate-500 dark:text-gray-400">{r.type === 'tow' ? 'Tow truck' : 'Roadside help'}</span>
                        </td>
                        <td className="truncate px-3 py-3" title={r.issue}>
                          {r.issue || '—'}
                        </td>
                        <td className="truncate px-3 py-3" title={r.pickupAddress || r.location}>
                          {r.pickupAddress || r.location || '—'}
                        </td>
                        <td className="truncate px-3 py-3">
                          {r.acceptedProviderDisplayName || <span className="text-slate-400">{waitingNow ? 'Not taken yet' : '—'}</span>}
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={statusToBadgeVariant(r.status ?? '')}>
                            {requestStatusLabel(r.status)}
                            {waitingNow && r.createdAt ? ` · ${ago(r.createdAt)}` : ''}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
