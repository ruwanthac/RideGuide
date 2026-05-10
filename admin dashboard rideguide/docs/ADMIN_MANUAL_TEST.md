# Manual test checklist — Admin web + API

## Prereqs

- MongoDB running; `backend/.env` from `backend/.env.example` (`MONGODB_URI`, `JWT_SECRET` ≥ 16 chars, `CORS_ORIGIN`).
- Create admin: `cd backend && npm run create-admin -- admin@local.test YourPassword123`
- API default **PORT=3000**; if you use another port, set root **`VITE_PROXY_TARGET`** to match.

## Backend

1. `cd backend && npm run dev` — listens on **PORT** (default **3000**).
2. `curl -s http://localhost:3000/api/health` → `{ "ok": true }`.
3. `curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@local.test","password":"YourPassword123"}'` → returns `token`.
4. `curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer <token>"` → `{ "user": { ... } }`.

## Frontend

1. Root: `npm run dev` (Vite proxies `/api` → 4000).
2. Open `/login`, sign in with admin user → redirected to `/`.
3. **Dashboard** — stats load; charts show (may be zeros before seed).
4. **Users / Vehicles / Requests / Diagnoses / Analytics / Audit logs** — tables load or show error banner if API down.
5. **Users → Edit** — PATCH user (e.g. `displayName`, `phoneNumber`, `mechanicAvailable` for mechanics).
6. **Settings → Tow pricing** — GET shows `towPerKmLkr`; PATCH saves and reloads.
7. **Settings → Seed demo data** — only in **non-production** SPA builds. With `ALLOW_ADMIN_SEED=true` in `backend/.env`, seed succeeds and page reloads. With flag false, expect error about `ALLOW_ADMIN_SEED`. With `NODE_ENV=production` on the server, seed returns an error.
8. **Logout** (navbar) → returns to `/login`; protected routes redirect when not authenticated.
9. **401** — call any admin route with an invalid/expired token → token cleared and browser navigates to `/login`.

## Security spot-checks

- Non-admin JWT cannot call `GET /api/admin/stats` (403).
- `passwordHash` never appears in `GET /api/admin/users` JSON.
