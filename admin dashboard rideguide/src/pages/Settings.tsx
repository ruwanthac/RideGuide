import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { adminUrl, apiGet, apiPatch, apiPost, ApiError, getPublicApiOrigin } from '../lib/api';

const isProdBuild = import.meta.env.PROD;

export function Settings() {
  const [notifications, setNotifications] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const [towPerKm, setTowPerKm] = useState('');
  const [towLoading, setTowLoading] = useState(true);
  const [towSaving, setTowSaving] = useState(false);
  const [towErr, setTowErr] = useState<string | null>(null);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminDisplayName, setNewAdminDisplayName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [createAdminBusy, setCreateAdminBusy] = useState(false);
  const [createAdminErr, setCreateAdminErr] = useState<string | null>(null);
  const [createAdminMsg, setCreateAdminMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTowLoading(true);
      setTowErr(null);
      try {
        const res = await apiGet<{ towPerKmLkr: number }>(adminUrl('pricing/tow'));
        if (!cancelled) setTowPerKm(String(res.towPerKmLkr ?? ''));
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
    if (!Number.isFinite(n) || n < 0) {
      setTowErr('Enter a valid non-negative number');
      return;
    }
    setTowSaving(true);
    setTowErr(null);
    try {
      const res = await apiPatch<{ towPerKmLkr: number }>(adminUrl('pricing/tow'), { towPerKmLkr: n });
      setTowPerKm(String(res.towPerKmLkr));
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
          subtitle="POST /api/admin/admins — adds another dashboard admin (same role as you). Share credentials securely."
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
              <input
                type="password"
                autoComplete="new-password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                placeholder="At least 8 characters"
              />
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
        <CardHeader title="Tow pricing" subtitle="GET/PATCH /api/admin/pricing/tow — LKR per km" />
        <CardContent className="space-y-3">
          {towLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              {towErr && <p className="text-sm text-red-600 dark:text-red-400">{towErr}</p>}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  towPerKmLkr
                </label>
                <div className="flex max-w-md flex-wrap gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={towPerKm}
                    onChange={(e) => setTowPerKm(e.target.value)}
                    className="flex-1 min-w-[120px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  />
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

      <Card>
        <CardHeader title="Preferences" subtitle="Notification and display options" />
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Push notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Receive in-app notifications</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifications}
              onClick={() => setNotifications((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                notifications ? 'bg-accent-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  notifications ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Email alerts</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Critical alerts via email</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={emailAlerts}
              onClick={() => setEmailAlerts((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                emailAlerts ? 'bg-accent-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  emailAlerts ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {!isProdBuild && (
            <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Seed demo data</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    POST /api/admin/seed-demo — requires ALLOW_ADMIN_SEED=true on the API. Disabled when NODE_ENV=production
                    on the server. Optional ADMIN_SEED_CLEAR=true wipes non-admin data first.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={seeding}
                  onClick={async () => {
                    setSeedMessage(null);
                    try {
                      setSeeding(true);
                      const res = await apiPost<{ ok: boolean; error?: string }>(adminUrl('seed-demo'));
                      if (res.ok) {
                        window.location.reload();
                      } else {
                        setSeedMessage(res.error ?? 'Seed did not run.');
                      }
                    } catch (e) {
                      const msg =
                        e instanceof ApiError
                          ? (() => {
                              try {
                                return (JSON.parse(e.body) as { error?: string }).error ?? e.message;
                              } catch {
                                return e.message;
                              }
                            })()
                          : e instanceof Error
                            ? e.message
                            : 'Seed failed.';
                      setSeedMessage(msg);
                    } finally {
                      setSeeding(false);
                    }
                  }}
                  className="shrink-0 rounded-lg border border-accent-500 px-4 py-2 text-sm font-medium text-accent-600 dark:text-accent-400 disabled:opacity-60 hover:bg-accent-500/10 transition-colors"
                >
                  {seeding ? 'Seeding…' : 'Seed demo data'}
                </button>
              </div>
              {seedMessage && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{seedMessage}</p>
              )}
            </div>
          )}
          {isProdBuild && (
            <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-dashed border-gray-200 dark:border-gray-800">
              Demo seed controls are hidden in production builds of the admin app.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="System" subtitle="Configuration and maintenance" />
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Maintenance mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Disable public access temporarily</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={maintenanceMode}
              onClick={() => setMaintenanceMode((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                maintenanceMode ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  maintenanceMode ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API base (resolved)</label>
            <input
              type="text"
              value={
                [getPublicApiOrigin(), import.meta.env.VITE_API_BASE_URL, import.meta.env.VITE_API_URL]
                  .map((s) => (typeof s === 'string' ? s.trim() : ''))
                  .find(Boolean) ||
                '(dev: same-origin /api → VITE_PROXY_TARGET, default http://localhost:3000)'
              }
              readOnly
              className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-500 dark:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max requests per minute</label>
            <input
              type="number"
              defaultValue={100}
              className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
