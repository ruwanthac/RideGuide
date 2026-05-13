import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/ui/Modal';
import { adminUrl, apiGet, apiPost, ApiError } from '../lib/api';
import { totalPagesFrom } from '../lib/pagination';
import { AuthenticatedVerificationPreview } from '../components/AuthenticatedVerificationPreview';
import type { AdminUser, AdminUserDetail, ProviderVerificationFileField, UserRole } from '../types';

const roleLabels: Record<Extract<UserRole, 'mechanic' | 'tow'>, string> = {
  mechanic: 'Mechanic',
  tow: 'Tow',
};

const MECHANIC_FIELDS: { field: ProviderVerificationFileField; label: string }[] = [
  { field: 'mechanicBrCopy', label: 'Business registration (BR)' },
  { field: 'mechanicNicCopy', label: 'NIC copy' },
];

const TOW_FIELDS: { field: ProviderVerificationFileField; label: string }[] = [
  { field: 'towCompanyBrCopy', label: 'Company BR' },
  { field: 'towTruckRegCopy', label: 'Truck registration' },
  { field: 'towTruckNicCopy', label: 'Truck / owner NIC' },
];

interface Paginated {
  items: AdminUser[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function formatDate(iso: string | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ProviderApplications() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        q.set('pendingProviders', 'true');
        q.set('page', String(page));
        q.set('limit', '50');
        const res = await apiGet<Omit<Paginated, 'totalPages'>>(adminUrl(`users?${q.toString()}`));
        if (!cancelled) {
          setData({
            ...res,
            totalPages: totalPagesFrom(res.total, res.limit),
          });
        }
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof ApiError ? e.message : 'Failed to load applications');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, refreshKey]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const u = await apiGet<AdminUserDetail>(adminUrl(`users/${detailId}`));
        if (!cancelled) setDetail(u);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          setDetailError(e instanceof ApiError ? e.message : 'Failed to load user');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  async function verify() {
    if (!detailId) return;
    if (!window.confirm('Approve this provider? A one-time password will be emailed and their login password will be replaced.')) {
      return;
    }
    setActionBusy(true);
    setBanner(null);
    try {
      const res = await apiPost<{
        ok: boolean;
        emailSent?: boolean;
        emailError?: string;
        oneTimePassword?: string;
      }>(adminUrl(`users/${detailId}/verify-provider`));
      if (res.emailSent) {
        setBanner({ type: 'ok', text: 'Provider approved. A sign-in email with the one-time password was sent.' });
      } else {
        const errHint = res.emailError ? ` (${res.emailError})` : '';
        const otp = res.oneTimePassword;
        setBanner({
          type: 'ok',
          text: otp
            ? `Provider approved, but email was not sent${errHint}. Copy this one-time password for the provider: ${otp}`
            : `Provider approved, but email was not sent${errHint}. Check backend SMTP settings in .env.`,
        });
      }
      setDetailId(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setBanner({ type: 'err', text: e instanceof ApiError ? e.message : 'Verify failed' });
    } finally {
      setActionBusy(false);
    }
  }

  async function reject() {
    if (!detailId) return;
    if (!window.confirm('Reject this application? The user will not be able to sign in as a provider.')) {
      return;
    }
    setActionBusy(true);
    setBanner(null);
    try {
      await apiPost<{ ok: boolean }>(adminUrl(`users/${detailId}/reject-provider`));
      setBanner({ type: 'ok', text: 'Application rejected.' });
      setDetailId(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setBanner({ type: 'err', text: e instanceof ApiError ? e.message : 'Reject failed' });
    } finally {
      setActionBusy(false);
    }
  }

  const docFields =
    detail?.role === 'mechanic' ? MECHANIC_FIELDS : detail?.role === 'tow' ? TOW_FIELDS : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Provider applications</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Review mechanic and tow sign-ups. Approve to email a one-time sign-in password.
        </p>
      </div>

      {banner && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            banner.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
          }`}
        >
          {banner.text}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader
          title="Pending providers"
          subtitle={data ? `${data.total} pending` : '—'}
        />
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableHeader>
                <TableBody>
                  {(data?.items ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 dark:text-gray-400">
                        No pending applications.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.items ?? []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.displayName}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="default">
                            {u.role === 'mechanic' || u.role === 'tow' ? roleLabels[u.role] : u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-300">
                          {formatDate(u.providerVerificationSubmittedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            type="button"
                            onClick={() => setDetailId(u.id)}
                            className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-accent-600 dark:text-accent-400 hover:bg-accent-500/10"
                          >
                            Review
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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

      {detailId && (
        <Modal
          isOpen
          onClose={() => !actionBusy && setDetailId(null)}
          title="Provider application"
          panelClassName="max-w-3xl"
        >
          {detailLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {detailError && <p className="text-sm text-red-600 dark:text-red-400">{detailError}</p>}
          {!detailLoading && detail && (
            <div className="max-h-[80vh] space-y-4 overflow-y-auto text-sm">
              <div className="grid gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3">
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Name:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-white">{detail.displayName}</span>
                </p>
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Email:</span> {detail.email}
                </p>
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Phone:</span> {detail.phoneNumber || '—'}
                </p>
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Role:</span>{' '}
                  {detail.role === 'mechanic' || detail.role === 'tow' ? roleLabels[detail.role] : detail.role}
                </p>
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Business:</span>{' '}
                  {detail.businessName || '—'}
                </p>
                {detail.role === 'mechanic' && (
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">Workshop address:</span>{' '}
                    {detail.businessAddress || '—'}
                  </p>
                )}
                {detail.role === 'tow' && (
                  <>
                    <p>
                      <span className="text-gray-500 dark:text-gray-400">Truck:</span>{' '}
                      {detail.truckName || '—'}
                    </p>
                    <p>
                      <span className="text-gray-500 dark:text-gray-400">Plate:</span> {detail.plateNumber || '—'}
                    </p>
                  </>
                )}
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Submitted:</span>{' '}
                  {formatDate(detail.providerVerificationSubmittedAt)}
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">Documents</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {docFields.map(({ field, label }) =>
                    detail.providerVerification?.[field] ? (
                      <AuthenticatedVerificationPreview
                        key={field}
                        userId={detail.id}
                        field={field}
                        label={label}
                      />
                    ) : (
                      <div
                        key={field}
                        className="rounded-lg border border-dashed border-gray-300 p-3 text-gray-500 dark:border-gray-600 dark:text-gray-400"
                      >
                        {label}: missing
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                <button
                  type="button"
                  disabled={actionBusy || detail.providerVerificationStatus !== 'pending'}
                  onClick={() => void verify()}
                  className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
                >
                  {actionBusy ? 'Working…' : 'Verify & email OTP'}
                </button>
                <button
                  type="button"
                  disabled={actionBusy || detail.providerVerificationStatus !== 'pending'}
                  onClick={() => void reject()}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-950/40 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => setDetailId(null)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
