import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { Badge, statusToBadgeVariant } from '../components/ui/Badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { adminUrl, apiGet, ApiError } from '../lib/api';
import { totalPagesFrom } from '../lib/pagination';

interface DiagnosisRow {
  id: string;
  status: string;
  userId: string;
  userName: string;
  vehicleId?: string;
  summary?: string;
  createdAt: string;
  updatedAt?: string;
}

function mapApiDiagnosis(raw: Record<string, unknown>): DiagnosisRow {
  const id = String(raw.id ?? raw._id ?? '');
  const diag = String(raw.diagnosis ?? '');
  const summary = diag.length > 140 ? `${diag.slice(0, 140)}…` : diag || '—';
  const severity = String(raw.severity ?? 'recorded');
  const userName = String(raw.userName ?? '');
  const userId = String(raw.userId ?? '');
  const createdRaw = raw.createdAt;
  const createdAt =
    createdRaw instanceof Date
      ? createdRaw.toISOString()
      : typeof createdRaw === 'string'
        ? createdRaw
        : '';
  return { id, status: severity, userId, userName, summary, createdAt };
}

interface PaginatedDiagnoses {
  items: DiagnosisRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const LIMIT = 25;

export function Diagnoses() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedDiagnoses | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, from, to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        q.set('page', String(page));
        q.set('limit', String(LIMIT));
        if (debouncedSearch.trim()) q.set('search', debouncedSearch.trim());
        if (from) q.set('from', from);
        if (to) q.set('to', to);
        const res = await apiGet<{
          items: Record<string, unknown>[];
          page: number;
          limit: number;
          total: number;
        }>(adminUrl(`diagnoses?${q.toString()}`));
        if (!cancelled)
          setData({
            ...res,
            totalPages: totalPagesFrom(res.total, res.limit),
            items: res.items.map((row) => mapApiDiagnosis(row)),
          });
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof ApiError ? e.message : 'Failed to load diagnoses');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, from, to, page]);

  const rows = data?.items ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Diagnoses</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Vehicle diagnosis records (not service requests)</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader title="Diagnosis records" subtitle={data ? `${data.total} records` : '—'} />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative max-w-xs flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search user or summary…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 py-2 pl-10 pr-4 text-sm"
              />
            </div>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              aria-label="From date"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              aria-label="To date"
            />
          </div>
          {loading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableHead>User</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Created</TableHead>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.userName}</TableCell>
                      <TableCell className="max-w-xs truncate">{r.summary ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={statusToBadgeVariant(r.status)}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-gray-500 dark:text-gray-400">
                        {new Date(r.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data && data.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Page {data.page} of {data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                      disabled={page >= data.totalPages}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
