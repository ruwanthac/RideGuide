# Admin API — manual QA checklist

Prerequisites: MongoDB running, `backend/.env` configured, at least one `admin` user (`npm run create-admin` if available, or promote in DB).

1. **Login** — `POST /api/auth/login` with admin credentials; response includes `role: 'admin'` and `token`.
2. **Stats** — `GET /api/admin/stats` with `Authorization: Bearer <token>` → **200** and JSON with `userCount`, `requestsToday`, etc.
3. **Users** — `GET /api/admin/users?page=1&limit=10` → **200**, `items` array, `total` number.
4. **403** — Repeat any `/api/admin/*` with a non-admin token → **403**.
5. **Requests** — `GET /api/admin/requests?type=tow` → **200**, paginated shape.
6. **Vehicles / Diagnoses** — `GET /api/admin/vehicles`, `GET /api/admin/diagnoses` → **200**.
7. **Analytics** — `GET /api/admin/analytics?days=30` → **200**; rapid repeat should still succeed under rate limit.
8. **Audit** — After `PATCH /admin/users/:id` or `PATCH /admin/pricing/tow`, `GET /api/admin/audit-logs?limit=5` shows new rows.
9. **Seed (dev only)** — Set `ALLOW_ADMIN_SEED=true`, `NODE_ENV=development`; `POST /api/admin/seed-demo` → **200** and `created` counts. With `ADMIN_SEED_CLEAR=true`, confirm you understand data loss before running.
