import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { TableSkeleton } from '../components/ui/Skeleton';
import { adminUrl, apiGet, ApiError } from '../lib/api';
import { totalPagesFrom } from '../lib/pagination';

interface AuditRow {
  id: string;
  action: string;
  admin: { id: string; email?: string; displayName?: string };
  targetType?: string;
  targetId?: string;
  meta?: unknown;
  createdAt: string;
}

interface Paginated {
  items: AuditRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const LIMIT = 25;

function mapAuditRow(raw: Record<string, unknown>): AuditRow {
  const id = String(raw.id ?? raw._id ?? '');
  const adminId = raw.adminId as Record<string, unknown> | string | undefined;
  const admin =
    adminId && typeof adminId === 'object'
      ? {
          id: String(adminId._id ?? adminId.id ?? ''),
          email: adminId.email as string | undefined,
          displayName: adminId.displayName as string | undefined,
        }
      : { id: typeof adminId === 'string' ? adminId : '', email: undefined, displayName: undefined };
  const createdAt =
    raw.createdAt instanceof Date
      ? raw.createdAt.toISOString()
      : typeof raw.createdAt === 'string'
        ? raw.createdAt
        : '';
  return {
    id,
    action: String(raw.action ?? ''),
    admin,
    targetType: raw.targetType != null ? String(raw.targetType) : undefined,
    targetId: raw.targetId != null ? String(raw.targetId) : undefined,
    meta: raw.meta,
    createdAt,
  };
}

export function AuditLogs() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
        const res = await apiGet<{
          items: Record<string, unknown>[];
          page: number;
          limit: number;
          total: number;
        }>(adminUrl(`audit-logs?${q}`));
        if (!cancelled)
          setData({
            ...res,
            totalPages: totalPagesFrom(res.total, res.limit),
            items: res.items.map((row) => mapAuditRow(row)),
          });
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof ApiError ? e.message : 'Failed to load audit logs');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const rows = data?.items ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Audit logs</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Admin actions recorded by the API</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader title="Recent entries" subtitle={data ? `${data.total} total` : '—'} />
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <TableSkeleton rows={5} cols={5} />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Target</TableHead>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.action}</TableCell>
                      <TableCell>{r.admin?.email ?? r.admin?.displayName ?? r.admin?.id ?? '—'}</TableCell>
                      <TableCell className="text-xs text-gray-600 dark:text-gray-400">
                        {r.targetType ? `${r.targetType}${r.targetId ? ` / ${r.targetId}` : ''}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data && data.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                  <p className="text-sm text-gray-500">
                    Page {data.page} of {data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                      className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
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
