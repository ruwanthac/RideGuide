import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { TableSkeleton } from '../components/ui/Skeleton';
import { adminUrl, apiGet, ApiError } from '../lib/api';
import { totalPagesFrom } from '../lib/pagination';
import type { Vehicle } from '../types';

const ITEMS_PER_PAGE = 20;

interface PaginatedVehicles {
  items: Vehicle[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Populated owner, raw ObjectId string, or null if ref is missing — all must be safe to render. */
function ownerDisplay(raw: unknown) {
  if (raw == null || typeof raw === 'string') return { name: '—', email: '', phone: '' };
  if (typeof raw !== 'object') return { name: '—', email: '', phone: '' };
  const o = raw as Record<string, unknown>;
  const email = typeof o.email === 'string' ? o.email : '';
  const phone = typeof o.phoneNumber === 'string' ? o.phoneNumber : '';
  const displayName = typeof o.displayName === 'string' ? o.displayName : '';
  const id =
    typeof o.id === 'string' ? o.id : o._id != null ? String(o._id) : '';
  const name = displayName.trim() || email.trim() || id || '—';
  return { name, email: email.trim(), phone: phone.trim() };
}

function normalizeVehicle(v: Record<string, unknown>): Vehicle {
  const id = String(v.id ?? v._id ?? '');
  const plateRaw = v.plate ?? v.plateNumber ?? v.plate_no;
  const plate =
    typeof plateRaw === 'string'
      ? plateRaw.trim()
      : plateRaw != null
        ? String(plateRaw).trim()
        : '';
  return { ...(v as unknown as Vehicle), id, plate };
}

export function Vehicles() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedVehicles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        if (debouncedSearch.trim()) q.set('search', debouncedSearch.trim());
        q.set('page', String(page));
        q.set('limit', String(ITEMS_PER_PAGE));
        const res = await apiGet<Omit<PaginatedVehicles, 'totalPages'>>(adminUrl(`vehicles?${q.toString()}`));
        const rows = Array.isArray(res.items) ? res.items : [];
        const total = typeof res.total === 'number' ? res.total : rows.length;
        const lim = typeof res.limit === 'number' ? res.limit : ITEMS_PER_PAGE;
        const pg = typeof res.page === 'number' ? res.page : page;
        if (!cancelled)
          setData({
            items: rows.map((row) => normalizeVehicle(row as unknown as Record<string, unknown>)),
            total,
            page: pg,
            limit: lim,
            totalPages: totalPagesFrom(total, lim),
          });
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof ApiError ? e.message : 'Failed to load vehicles');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page]);

  const paginated = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Vehicles</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Registered vehicles and owners</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader title="All vehicles" subtitle={data ? `${data.total} vehicles` : '—'} />
        <CardContent>
          <div className="relative mb-4 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search by owner, vehicle, VIN, plate…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 py-2 pl-10 pr-4 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
          </div>
          {loading ? (
            <TableSkeleton rows={5} cols={7} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableHead>Owner</TableHead>
                  <TableHead>Owner email</TableHead>
                  <TableHead>Owner phone</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>VIN</TableHead>
                  <TableHead>Plate</TableHead>
                </TableHeader>
                <TableBody>
                  {paginated.map((v) => {
                    const o = ownerDisplay(v.ownerId);
                    const mm = `${v.make ?? ''} ${v.model ?? ''}`.trim();
                    const label = String(v.makeModel || v.label || mm || '—');
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell className="text-sm">{o.email || '—'}</TableCell>
                        <TableCell className="text-sm">{o.phone || '—'}</TableCell>
                        <TableCell>{label}</TableCell>
                        <TableCell>{v.year != null ? String(v.year) : '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{v.vin || '—'}</TableCell>
                        <TableCell>{(v.plate ?? '').trim() || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {data && data.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
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
    </div>
  );
}
