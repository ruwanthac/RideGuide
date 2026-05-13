import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, Trash2, Search } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { statusToBadgeVariant } from '../components/ui/badgeStatus';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton } from '../components/ui/Skeleton';
import { adminUrl, apiDelete, apiGet, ApiError } from '../lib/api';
import { totalPagesFrom } from '../lib/pagination';
import { SERVICE_REQUEST_STATUSES } from '../constants/serviceRequestStatuses';
import type { RequestStatus, ServiceRequestRow } from '../types';

type Tab = 'roadside' | 'tow';

interface PaginatedRequests {
  items: (ServiceRequestRow & { id: string })[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function normalizeRequestRow(r: ServiceRequestRow): ServiceRequestRow & { id: string } {
  const id = String(r.id ?? r._id ?? '');
  return { ...r, id };
}

function RequestDetailModal({
  requestId,
  onClose,
  onDeleted,
}: {
  requestId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [request, setRequest] = useState<ServiceRequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await apiGet<ServiceRequestRow>(adminUrl(`requests/${requestId}`));
        if (!cancelled) setRequest(normalizeRequestRow(r));
      } catch (e) {
        if (!cancelled) {
          setRequest(null);
          setErr(e instanceof ApiError ? e.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  async function handleDelete() {
    if (!confirm('Delete this request? This cannot be undone.')) return;
    setDeleting(true);
    setErr(null);
    try {
      await apiDelete(adminUrl(`requests/${requestId}`));
      onDeleted();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Request details">
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
      {request && (
        <>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">ID</dt>
              <dd className="font-mono">{request.id ?? request._id}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Type</dt>
              <dd className="capitalize">{request.type}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Status</dt>
              <dd>
                <Badge variant={statusToBadgeVariant(request.status)}>{request.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">User</dt>
              <dd>{request.userName}</dd>
            </div>
            {request.vehicle && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Vehicle</dt>
                <dd>{request.vehicle}</dd>
              </div>
            )}
            {(request.issue || request.description) && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Issue</dt>
                <dd>{request.issue ?? request.description}</dd>
              </div>
            )}
            {request.location && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Location</dt>
                <dd>{request.location}</dd>
              </div>
            )}
            {(request.assignedTo || request.acceptedProviderDisplayName) && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Assigned to</dt>
                <dd>{request.assignedTo ?? request.acceptedProviderDisplayName}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Created</dt>
              <dd>{new Date(request.createdAt).toLocaleString()}</dd>
            </div>
            {request.updatedAt && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Updated</dt>
                <dd>{new Date(request.updatedAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700">
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function Requests() {
  const location = useLocation();
  const navigate = useNavigate();
  const tabFromRoute: Tab = location.pathname === '/requests/tow' ? 'tow' : 'roadside';
  const [tab, setTab] = useState<Tab>(tabFromRoute);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [data, setData] = useState<PaginatedRequests | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setTab(tabFromRoute);
    setPage(1);
  }, [tabFromRoute]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, tab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        q.set('type', tab);
        q.set('page', String(page));
        q.set('limit', '50');
        if (debouncedSearch.trim()) q.set('search', debouncedSearch.trim());
        if (statusFilter) q.set('status', statusFilter);
        const res = await apiGet<Omit<PaginatedRequests, 'totalPages'>>(adminUrl(`requests?${q.toString()}`));
        if (!cancelled)
          setData({
            ...res,
            totalPages: totalPagesFrom(res.total, res.limit),
            items: res.items.map((row) => normalizeRequestRow(row as ServiceRequestRow)),
          });
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof ApiError ? e.message : 'Failed to load requests');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, page, debouncedSearch, statusFilter, refreshKey]);

  const requests = data?.items ?? [];

  const setActiveTab = (t: Tab) => {
    setTab(t);
    setPage(1);
    if (t === 'tow') navigate('/requests/tow');
    else navigate('/requests');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Requests</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Roadside and tow assistance requests</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader
          title={tab === 'roadside' ? 'Roadside requests' : 'Tow requests'}
          subtitle={data ? `${data.total} requests` : '—'}
          action={
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('roadside')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === 'roadside'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                Roadside
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tow')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === 'tow'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                Tow
              </button>
            </div>
          }
        />
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative max-w-xs flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search user, issue, location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 py-2 pl-10 pr-4 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RequestStatus | '')}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm max-w-[220px]"
            >
              <option value="">All statuses</option>
              {SERVICE_REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableHead>User</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.userName}</TableCell>
                      <TableCell>{r.vehicle ?? '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        <span title={r.issue ?? r.description ?? undefined}>
                          {r.issue ?? r.description ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusToBadgeVariant(r.status)}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-gray-500 dark:text-gray-400">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => setDetailId(r.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-accent-600 dark:text-accent-400 hover:bg-accent-500/10 transition-colors"
                        >
                          <Eye className="h-4 w-4" /> View
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data && data.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Page {data.page} of {data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                      disabled={page >= data.totalPages}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
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

      {detailId && (
        <RequestDetailModal
          requestId={detailId}
          onClose={() => setDetailId(null)}
          onDeleted={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
