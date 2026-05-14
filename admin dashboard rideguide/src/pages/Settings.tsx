import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { adminUrl, apiGet, apiPatch, apiPost, ApiError } from '../lib/api';

export function Settings() {
  const [towPerKm, setTowPerKm] = useState('');
  const [providerRadiusKm, setProviderRadiusKm] = useState('');
  const [openRequestExpiryMin, setOpenRequestExpiryMin] = useState('');
  const [towLoading, setTowLoading] = useState(true);
  const [towSaving, setTowSaving] = useState(false);
  const [towErr, setTowErr] = useState<string | null>(null);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminDisplayName, setNewAdminDisplayName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [createAdminBusy, setCreateAdminBusy] = useState(false);
  const [createAdminErr, setCreateAdminErr] = useState<string | null>(null);
  const [createAdminMsg, setCreateAdminMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTowLoading(true);
      setTowErr(null);
      try {
        const res = await apiGet<{
          towPerKmLkr: number;
          providerMatchRadiusKm?: number;
          openRequestExpiryMinutes?: number;
        }>(adminUrl('pricing/tow'));
        if (!cancelled) {
          setTowPerKm(String(res.towPerKmLkr ?? ''));
          setProviderRadiusKm(String(res.providerMatchRadiusKm ?? 15));
          setOpenRequestExpiryMin(String(res.openRequestExpiryMinutes ?? 30));
        }
      } catch (e) {
        if (!cancelled) setTowErr(e instanceof ApiError ? e.message : 'Failed to load pricing');
      } finally {
        if (!cancelled) setTowLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveTowPricing() {
    const n = Number(towPerKm);
    const r = Number(providerRadiusKm);
    const expMin = Number(openRequestExpiryMin);
    if (!Number.isFinite(n) || n < 0) {
      setTowErr('Tow per km must be a valid non-negative number');
      return;
    }
    if (!Number.isFinite(r) || r < 1 || r > 500) {
      setTowErr('Provider match radius must be between 1 and 500 km');
      return;
    }
    if (!Number.isFinite(expMin) || expMin < 1 || expMin > 10080) {
      setTowErr('Open request expiry must be between 1 and 10080 minutes (7 days max)');
      return;
    }
    setTowSaving(true);
    setTowErr(null);
    try {
      const res = await apiPatch<{
        towPerKmLkr: number;
        providerMatchRadiusKm: number;
        openRequestExpiryMinutes: number;
      }>(adminUrl('pricing/tow'), {
        towPerKmLkr: n,
        providerMatchRadiusKm: r,
        openRequestExpiryMinutes: Math.round(expMin),
      });
      setTowPerKm(String(res.towPerKmLkr));
      setProviderRadiusKm(String(res.providerMatchRadiusKm ?? r));
      setOpenRequestExpiryMin(String(res.openRequestExpiryMinutes ?? expMin));
    } catch (e) {
      setTowErr(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setTowSaving(false);
    }
  }

  async function createAdminAccount() {
    setCreateAdminErr(null);
    setCreateAdminMsg(null);
    const email = newAdminEmail.trim();
    const displayName = newAdminDisplayName.trim();
    const phone = newAdminPhone.trim();
    if (!email || !newAdminPassword || !displayName) {
      setCreateAdminErr('Email, password, and display name are required.');
      return;
    }
    if (newAdminPassword.length < 8) {
      setCreateAdminErr('Password must be at least 8 characters.');
      return;
    }
    setCreateAdminBusy(true);
    try {
      await apiPost<{ email: string; displayName: string; role: string }>(adminUrl('admins'), {
        email,
        password: newAdminPassword,
        displayName,
        phoneNumber: phone || null,
      });
      setCreateAdminMsg(
        'Admin account created. The new user can sign in on this dashboard with the email and password you set.',
      );
      setNewAdminEmail('');
      setNewAdminPassword('');
      setShowAdminPassword(false);
      setNewAdminDisplayName('');
      setNewAdminPhone('');
    } catch (e) {
      setCreateAdminErr(e instanceof ApiError ? e.message : 'Failed to create admin');
    } finally {
      setCreateAdminBusy(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">System configuration</p>
      </div>

      <Card>
        <CardHeader
          title="Create admin account"
          subtitle="Add another operations administrator with the same dashboard access. Send their sign-in details only through a secure channel."
        />
        <CardContent className="space-y-3">
          {createAdminErr && <p className="text-sm text-red-600 dark:text-red-400">{createAdminErr}</p>}
          {createAdminMsg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{createAdminMsg}</p>}
          <div className="grid max-w-lg gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                autoComplete="off"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                placeholder="admin@example.com"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Temporary password</label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-3 pr-10 text-sm"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                  aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                >
                  {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Display name</label>
              <input
                type="text"
                value={newAdminDisplayName}
                onChange={(e) => setNewAdminDisplayName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                placeholder="Operations team"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone (optional)</label>
              <input
                type="tel"
                value={newAdminPhone}
                onChange={(e) => setNewAdminPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                placeholder="+94…"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={createAdminBusy}
            onClick={() => void createAdminAccount()}
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {createAdminBusy ? 'Creating…' : 'Create admin'}
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Tow pricing, job radius & request expiry" />
        <CardContent className="space-y-3">
          {towLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              {towErr && <p className="text-sm text-red-600 dark:text-red-400">{towErr}</p>}
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xl">
                Providers must share live location in the app. If they have no location saved, all open jobs are listed
                (legacy). When location exists, only jobs within this radius of their position appear in the job list.
                Unclaimed open requests (no provider accepted yet) are removed after the expiry window; scheduled tow
                requests use the scheduled time plus this window.
              </p>
              <div className="grid max-w-md gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tow hire rate (LKR per km)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={towPerKm}
                    onChange={(e) => setTowPerKm(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Provider job radius (km)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    step={1}
                    value={providerRadiusKm}
                    onChange={(e) => setProviderRadiusKm(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Unclaimed request expiry (minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10080}
                    step={1}
                    value={openRequestExpiryMin}
                    onChange={(e) => setOpenRequestExpiryMin(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Default 30. Applies to new requests; max 10080 (7 days).
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    disabled={towSaving}
                    onClick={() => void saveTowPricing()}
                    className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
                  >
                    {towSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
