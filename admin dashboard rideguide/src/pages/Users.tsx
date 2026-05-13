import { useEffect, useState } from 'react';
import { Search, Pencil } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/ui/Modal';
import { adminUrl, apiGet, apiPatch, ApiError } from '../lib/api';
import { totalPagesFrom } from '../lib/pagination';
import { statusToBadgeVariant } from '../components/ui/badgeStatus';
import type { AdminUser, UserRole, UserStatus } from '../types';

const roleLabels: Record<UserRole, string> = {
  owner: 'Owner',
  mechanic: 'Mechanic',
  tow: 'Tow',
  admin: 'Admin',
};

interface PaginatedUsers {
  items: AdminUser[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? '');
  const [mechanicAvailable, setMechanicAvailable] = useState(user.mechanicAvailable !== false);
  const [businessName, setBusinessName] = useState(user.businessName ?? '');
  const [businessAddress, setBusinessAddress] = useState(user.businessAddress ?? '');
  const [truckName, setTruckName] = useState(user.truckName ?? '');
  const [plateNumber, setPlateNumber] = useState(user.plateNumber ?? '');
  const [status, setStatus] = useState<UserStatus>(user.status ?? 'active');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (role !== user.role) body.role = role;
      if (displayName.trim() !== user.displayName) body.displayName = displayName.trim();
      if (phoneNumber.trim() !== (user.phoneNumber ?? '')) body.phoneNumber = phoneNumber.trim();
      if (user.role === 'mechanic' && mechanicAvailable !== (user.mechanicAvailable !== false)) {
        body.mechanicAvailable = mechanicAvailable;
      }
      if ((user.role === 'tow' || role === 'tow') && businessName.trim() !== (user.businessName ?? '')) {
        body.businessName = businessName.trim();
      }
      if ((user.role === 'tow' || role === 'tow') && businessAddress.trim() !== (user.businessAddress ?? '')) {
        body.businessAddress = businessAddress.trim();
      }
      if ((user.role === 'tow' || role === 'tow') && truckName.trim() !== (user.truckName ?? '')) {
        body.truckName = truckName.trim();
      }
      if ((user.role === 'tow' || role === 'tow') && plateNumber.trim() !== (user.plateNumber ?? '')) {
        body.plateNumber = plateNumber.trim();
      }
      if (status !== (user.status ?? 'active')) body.status = status;
      if (Object.keys(body).length === 0) {
        onClose();
        return;
      }
      await apiPatch(adminUrl(`users/${user.id}`), body);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Edit user">
      <div className="space-y-3 text-sm">
        {err && <p className="text-red-600 dark:text-red-400">{err}</p>}
        <div>
          <label className="mb-1 block text-gray-600 dark:text-gray-400">Email</label>
          <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
            {user.email}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-gray-600 dark:text-gray-400">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-gray-600 dark:text-gray-400">Phone</label>
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-gray-600 dark:text-gray-400">Account status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-gray-600 dark:text-gray-400">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
          >
            {(['owner', 'mechanic', 'tow', 'admin'] as const).map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
        </div>
        {(role === 'mechanic' || user.role === 'mechanic') && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mechanicAvailable}
              onChange={(e) => setMechanicAvailable(e.target.checked)}
            />
            Mechanic available
          </label>
        )}
        {(role === 'tow' || user.role === 'tow') && (
          <>
            <div>
              <label className="mb-1 block text-gray-600 dark:text-gray-400">Business name</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-gray-600 dark:text-gray-400">Business address</label>
              <input
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-gray-600 dark:text-gray-400">Truck name</label>
              <input
                value={truckName}
                onChange={(e) => setTruckName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-gray-600 dark:text-gray-400">Plate number</label>
              <input
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
              />
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Users() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedUsers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        if (debouncedSearch.trim()) q.set('search', debouncedSearch.trim());
        if (roleFilter !== 'all') q.set('role', roleFilter);
        if (statusFilter !== 'all') q.set('status', statusFilter);
        q.set('page', String(page));
        q.set('limit', '50');
        const res = await apiGet<Omit<PaginatedUsers, 'totalPages'>>(adminUrl(`users?${q.toString()}`));
        if (!cancelled)
          setData({
            ...res,
            totalPages: totalPagesFrom(res.total, res.limit),
          });
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof ApiError ? e.message : 'Failed to load users');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, roleFilter, statusFilter, page, refreshKey]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Users</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage platform users and roles</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader
          title="All users"
          subtitle={data ? `${data.total} users` : '—'}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
              >
                <option value="all">All roles</option>
                {(['owner', 'mechanic', 'tow', 'admin'] as const).map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          }
        />
        <CardContent>
          <div className="relative mb-4 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search by name, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 py-2 pl-10 pr-4 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
          </div>
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableHeader>
                <TableBody>
                  {(data?.items ?? []).map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.displayName}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.phoneNumber || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="default">{roleLabels[u.role]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusToBadgeVariant(u.status ?? 'active')}>{u.status ?? 'active'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => setEditUser(u)}
                          className="inline-flex items-center gap-1 rounded p-1.5 text-sm text-accent-600 dark:text-accent-400 hover:bg-accent-500/10"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
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

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
