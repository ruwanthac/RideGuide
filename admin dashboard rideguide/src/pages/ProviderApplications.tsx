import { useEffect, useMemo, useState } from 'react';
import { Copy, Inbox } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { adminUrl, apiGet, apiPost, ApiError } from '../lib/api';
import { AuthenticatedVerificationPreview } from '../components/AuthenticatedVerificationPreview';
import { notifyCountsChanged } from '../hooks/useAttentionCounts';
import type { AdminUser, AdminUserDetail, ProviderVerificationFileField } from '../types';

type Tab = 'pending' | 'approved' | 'rejected';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const DOC_LABELS: Record<ProviderVerificationFileField, string> = {
  mechanicBrCopy: 'Business registration',
  mechanicNicCopy: 'National ID (NIC)',
  towCompanyBrCopy: 'Company registration',
  towCompanyNicCopy: 'Company owner NIC',
  towTruckRegCopy: 'Truck registration',
  towTruckNicCopy: 'Truck owner NIC',
};
/** Documents each provider type must upload at sign-up. */
const REQUIRED_DOCS: Record<'mechanic' | 'tow', ProviderVerificationFileField[]> = {
  mechanic: ['mechanicBrCopy', 'mechanicNicCopy'],
  tow: ['towCompanyBrCopy', 'towTruckRegCopy', 'towTruckNicCopy'],
};

function ago(iso?: string): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return mins < 1 ? 'just now' : `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}

function when(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const avatarTone = (role: string) =>
  role === 'tow' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300';

const roleLabel = (role: string) => (role === 'tow' ? 'Tow truck' : role === 'mechanic' ? 'Mechanic' : role);

export function ProviderApplications() {
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'approve' | 'reject' | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string; otp?: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ page: '1', limit: '100' });
        if (tab === 'pending') q.set('pendingProviders', 'true');
        else q.set('providerVerificationStatus', tab);
        const res = await apiGet<{ items: AdminUser[]; total: number }>(adminUrl(`users?${q.toString()}`));
        if (cancelled) return;
        // Oldest first when waiting (first come, first served); newest first otherwise.
        const rows = (res.items ?? [])
          .filter((u) => u.role === 'mechanic' || u.role === 'tow')
          .sort((a, b) => {
            const ta = new Date(a.providerVerificationSubmittedAt ?? a.joinedAt ?? 0).getTime();
            const tb = new Date(b.providerVerificationSubmittedAt ?? b.joinedAt ?? 0).getTime();
            return tab === 'pending' ? ta - tb : tb - ta;
          });
        setItems(rows);
        setTotal(tab === 'pending' ? res.total : rows.length);
        setSelectedId((cur) => (cur && rows.some((r) => r.id === cur) ? cur : rows[0]?.id ?? null));
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setSelectedId(null);
          setError(e instanceof ApiError ? e.message : 'We couldn’t load applications. Please refresh the page.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, refreshKey]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const u = await apiGet<AdminUserDetail>(adminUrl(`users/${selectedId}`));
        if (!cancelled) setDetail(u);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          setDetailError(e instanceof ApiError ? e.message : 'We couldn’t load this application.');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const docs = useMemo(() => {
    if (!detail || (detail.role !== 'mechanic' && detail.role !== 'tow')) return [];
    const uploaded = Object.keys(detail.providerVerification ?? {}).filter((k) => detail.providerVerification?.[k as ProviderVerificationFileField]) as ProviderVerificationFileField[];
    const fields = [...new Set([...REQUIRED_DOCS[detail.role], ...uploaded])].filter((f) => f in DOC_LABELS);
    return fields.map((f) => ({ field: f, label: DOC_LABELS[f], present: uploaded.includes(f) }));
  }, [detail]);

  async function runAction(kind: 'approve' | 'reject') {
    if (!detail) return;
    setBusy(true);
    setBanner(null);
    const name = detail.displayName;
    try {
      if (kind === 'approve') {
        const res = await apiPost<{ ok: boolean; emailSent?: boolean; emailError?: string; oneTimePassword?: string }>(
          adminUrl(`users/${detail.id}/verify-provider`)
        );
        if (res.emailSent) {
          setBanner({ type: 'ok', text: `${name} is approved. We emailed them a one-time password to sign in.` });
        } else if (res.oneTimePassword) {
          setBanner({
            type: 'ok',
            text: `${name} is approved, but the email didn’t send. Give them this one-time password so they can sign in:`,
            otp: res.oneTimePassword,
          });
        } else {
          setBanner({ type: 'ok', text: `${name} is approved, but the email didn’t send. Check the email (SMTP) settings in the backend .env.` });
        }
      } else {
        await apiPost<{ ok: boolean }>(adminUrl(`users/${detail.id}/reject-provider`));
        setBanner({ type: 'ok', text: `${name}’s application was rejected. They can’t sign in as a provider.` });
      }
      setConfirm(null);
      setSelectedId(null);
      setRefreshKey((k) => k + 1);
      notifyCountsChanged();
    } catch (e) {
      setConfirm(null);
      setBanner({ type: 'err', text: e instanceof ApiError ? e.message : 'That didn’t work. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const status = detail?.providerVerificationStatus;

  return (
    <div className="flex flex-col gap-5 animate-fade-in lg:h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Provider applications</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
          Check the documents, then approve or reject. Approved providers get a one-time password by email.
        </p>
      </div>

      {banner && (
        <div
          role="status"
          className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            banner.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
          }`}
        >
          <span className="flex-1">{banner.text}</span>
          {banner.otp && (
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(banner.otp!)}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 font-mono text-sm font-bold text-emerald-900 hover:bg-emerald-100"
              title="Copy"
            >
              {banner.otp} <Copy className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* List */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-900" aria-label="Applications">
          <div role="tablist" aria-label="Application status" className="flex gap-1.5 px-1.5 pb-2.5 pt-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  setSelectedId(null);
                }}
                className={`h-8 rounded-full px-3 text-xs font-bold transition-colors ${
                  tab === t.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {t.label}
                {tab === t.id && !loading ? ` · ${total}` : ''}
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />)
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-slate-500 dark:text-gray-400">
                <Inbox className="h-6 w-6" />
                {tab === 'pending' ? 'No applications waiting. New sign-ups appear here.' : `No ${tab} applications yet.`}
              </div>
            ) : (
              items.map((u) => {
                const on = u.id === selectedId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedId(u.id)}
                    aria-current={on ? 'true' : undefined}
                    className={`flex items-center gap-3 rounded-xl border-[1.5px] p-3 text-left transition-colors ${
                      on ? 'border-accent-300 bg-accent-50 dark:border-accent-500/50 dark:bg-accent-500/10' : 'border-transparent hover:bg-slate-50 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${avatarTone(u.role)}`}>{initials(u.displayName)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{u.displayName}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-gray-400">
                        {roleLabel(u.role)}
                        {u.businessName ? ` · ${u.businessName}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{ago(tab === 'pending' ? u.providerVerificationSubmittedAt ?? u.joinedAt : u.providerVerificationReviewedAt ?? u.joinedAt)}</span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Detail */}
        <section className="flex min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900" aria-label="Application details">
          {!selectedId ? (
            <div className="m-auto text-sm text-slate-500 dark:text-gray-400">{loading ? 'Loading…' : 'Choose an application on the left.'}</div>
          ) : detailLoading || !detail ? (
            detailError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{detailError}</p>
            ) : (
              <div className="space-y-4">
                <div className="h-14 w-72 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />
                <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />
                <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />
              </div>
            )
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <span className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-extrabold ${avatarTone(detail.role)}`}>{initials(detail.displayName)}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-extrabold text-slate-900 dark:text-white">{detail.displayName}</h2>
                  <p className="text-sm text-slate-500 dark:text-gray-400">
                    {roleLabel(detail.role)} · applied {when(detail.providerVerificationSubmittedAt ?? detail.joinedAt)}
                  </p>
                </div>
                <Badge variant={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'}>
                  {status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Waiting for review'}
                </Badge>
              </div>

              <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  [detail.role === 'tow' ? 'Company' : 'Workshop', detail.businessName],
                  detail.role === 'tow' ? ['Truck', [detail.truckName, detail.plateNumber].filter(Boolean).join(' · ')] : ['Address', detail.businessAddress],
                  ['Email', detail.email],
                  ['Phone', detail.phoneNumber],
                ].map(([k, v]) => (
                  <div key={k as string} className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-gray-800/60">
                    <dt className="text-xs text-slate-500 dark:text-gray-400">{k}</dt>
                    <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900 dark:text-white">{(v as string) || '—'}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6">
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Documents</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {docs.map((d) =>
                    d.present ? (
                      <AuthenticatedVerificationPreview key={d.field} userId={detail.id} field={d.field} label={d.label} />
                    ) : (
                      <div key={d.field} className="flex flex-col gap-2">
                        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-red-200 bg-red-50/50 px-4 text-center text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                          Not uploaded
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-gray-100">{d.label}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {status === 'pending' ? (
                <div className="mt-auto flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setConfirm('reject')}
                    disabled={busy}
                    className="h-11 rounded-xl border-[1.5px] border-red-200 bg-white px-5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:bg-transparent dark:text-red-300"
                  >
                    Reject…
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm('approve')}
                    disabled={busy}
                    className="h-11 rounded-xl bg-emerald-700 px-6 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    Approve and send password
                  </button>
                </div>
              ) : (
                <p className="mt-auto border-t border-slate-100 pt-4 text-sm text-slate-500 dark:border-gray-800 dark:text-gray-400">
                  {status === 'approved' ? 'Approved' : 'Rejected'} {when(detail.providerVerificationReviewedAt)}.
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <Modal isOpen={confirm !== null} onClose={() => !busy && setConfirm(null)} title={confirm === 'approve' ? 'Approve this provider?' : 'Reject this application?'}>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-gray-300">
          {confirm === 'approve'
            ? `${detail?.displayName} will be able to sign in as a ${roleLabel(detail?.role ?? '').toLowerCase()}. We’ll email them a one-time password, which replaces the password they chose.`
            : `${detail?.displayName} won’t be able to sign in as a provider. You can’t undo this here.`}
        </p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-gray-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => confirm && void runAction(confirm)}
            disabled={busy}
            className={`h-10 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-60 ${confirm === 'approve' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {busy ? 'Working…' : confirm === 'approve' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
