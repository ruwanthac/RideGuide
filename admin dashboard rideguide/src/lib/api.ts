const TOKEN_KEY = 'rideguide_admin_token';

/**
 * Public API origin only — no trailing slash (e.g. `http://localhost:3000`).
 * Env: **`VITE_API_BASE_URL`** (preferred). Legacy: **`VITE_API_URL`** if it was set to the same origin or to `.../api` (suffix stripped).
 * When unset, the SPA uses same-origin relative URLs (`/api/...`) and Vite proxies `/api` → `VITE_PROXY_TARGET` (default `http://localhost:3000`).
 */
export function getPublicApiOrigin(): string {
  const raw =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!raw) return '';
  let u = raw.replace(/\/$/, '');
  while (u.endsWith('/api')) {
    u = u.slice(0, -4).replace(/\/$/, '');
  }
  return u;
}

/** `GET /api/health` — no auth. */
export function healthUrl(): string {
  const o = getPublicApiOrigin();
  return o ? `${o}/api/health` : '/api/health';
}

/** Admin REST under `/api/admin/…` */
export function adminUrl(path: string): string {
  const p = path.replace(/^\//, '');
  const o = getPublicApiOrigin();
  return o ? `${o}/api/admin/${p}` : `/api/admin/${p}`;
}

/** Auth under `/api/auth/…` */
export function authUrl(path: string): string {
  const p = path.replace(/^\//, '');
  const o = getPublicApiOrigin();
  return o ? `${o}/api/auth/${p}` : `/api/auth/${p}`;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredToken(): string | null {
  return getToken();
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function authHeader(): HeadersInit {
  const token = getToken();
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(body || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** Best-effort `{ error: string }` from response body text. */
export function parseApiErrorMessage(text: string): string {
  if (!text) return '';
  try {
    const j = JSON.parse(text) as { error?: string };
    return j.error ?? text;
  } catch {
    return text;
  }
}

function redirectLoginOnUnauthorized() {
  setStoredToken(null);
  window.dispatchEvent(new CustomEvent('rideguide:auth'));
  if (!window.location.pathname.startsWith('/login')) {
    window.location.replace('/login');
  }
}

async function parseJson<T>(res: Response, opts?: { skipAuthRedirect?: boolean }): Promise<T> {
  const text = await res.text();
  if (res.status === 401) {
    if (!opts?.skipAuthRedirect) {
      redirectLoginOnUnauthorized();
    }
    throw new ApiError(401, parseApiErrorMessage(text) || text || 'Unauthorized');
  }
  if (res.status === 403) {
    throw new ApiError(403, parseApiErrorMessage(text) || text || 'Forbidden');
  }
  if (!res.ok) {
    throw new ApiError(res.status, parseApiErrorMessage(text) || text || res.statusText);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeader() });
  return parseJson<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: authHeader(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseJson<T>(res);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: authHeader(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseJson<T>(res);
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE', headers: authHeader() });
  if (res.status === 204) return;
  await parseJson(res);
}

/** Current user — `GET /api/auth/me` returns a flat user object (not wrapped in `{ user }`). */
export type AuthMeUser = {
  id: string;
  _id?: string;
  email: string;
  displayName: string;
  role: string;
};

export async function fetchCurrentUser(): Promise<AuthMeUser> {
  return apiGet<AuthMeUser>(authUrl('me'));
}

export async function login(email: string, password: string) {
  const res = await fetch(authUrl('login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson<{
    token?: string;
    accessToken?: string;
    user: { id: string; email: string; displayName: string; role: string };
  }>(res, { skipAuthRedirect: true });
  const token = data.token ?? data.accessToken;
  if (!token) {
    throw new ApiError(500, 'Login response missing token');
  }
  setStoredToken(token);
  return data.user;
}

export function logout() {
  setStoredToken(null);
}
