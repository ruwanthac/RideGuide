# Admin API (`backend/`)

All **`/api/admin/*`** routes require **`Authorization: Bearer <JWT>`** and **`user.role === 'admin'`** (otherwise **403**; missing/invalid token → **401**).

Base URL: **`{API_ORIGIN}/api`** (e.g. `http://localhost:3000/api`). The admin SPA sets **`VITE_API_BASE_URL`** to `API_ORIGIN` only (no `/api` suffix).

## Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/login` | `{ email, password }` | `{ token, user }` — user includes `id`, `email`, `displayName`, `role` |
| GET | `/api/auth/me` | — | `{ user: { id, _id, email, displayName, role } }` — requires Bearer |

Suspended users: login may return **403** with `{ error: 'Account suspended' }`.

## Admin

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/stats` | Dashboard KPIs |
| GET | `/api/admin/analytics` | `?days=` default **90**, range **1–366**; rate-limited (**~40/min**/IP) |
| GET | `/api/admin/users` | `?search=&role=&status=active\|suspended&page=&limit=` |
| PATCH | `/api/admin/users/:id` | At least one of: `role`, `displayName`, `phoneNumber`, `mechanicAvailable`, `businessName`, `businessAddress`, `truckName`, `plateNumber`, **`status`**: `active` \| `suspended` |
| GET | `/api/admin/requests` | `type=roadside\|tow`, `status`, `from`, `to`, `search`, pagination |
| GET | `/api/admin/requests/:id` | Roadside/tow only |
| DELETE | `/api/admin/requests/:id` | **204** empty |
| GET | `/api/admin/vehicles` | `search`, `ownerId`, pagination; `ownerId` populated |
| GET | `/api/admin/diagnoses` | Diagnosis history — `search`, `from`, `to`, pagination |
| GET | `/api/admin/audit-logs` | Pagination |
| GET | `/api/admin/pricing/tow` | `{ towPerKmLkr }` |
| PATCH | `/api/admin/pricing/tow` | `{ towPerKmLkr }` (non-negative) |
| POST | `/api/admin/seed-demo` | Requires **`ALLOW_ADMIN_SEED=true`** and **not** production on server; optional **`ADMIN_SEED_CLEAR=true`** |

## Pagination

Query: **`page`** (1-based, default **1**), **`limit`** (default **20**, max **100**).

Response: **`{ items, total, page, limit, totalPages }`** (`totalPages` is a UI convenience).

## Errors

Many errors return **`{ "error": "message" }`**. Map **401** → login / invalid token, **403** → not admin or forbidden, **404** → missing entity.

## Health

`GET /api/health` → `{ ok: true }` (no auth).

## CORS

Set **`CORS_ORIGIN`** on the API (comma-separated). For production use explicit origins, not `*`, when using credentials.
