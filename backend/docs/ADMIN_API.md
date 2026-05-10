# Admin API (`/api/admin`)

All routes require `Authorization: Bearer <JWT>` where the user has `role: 'admin'`. Otherwise **403** (or **401** if missing/invalid token).

Base path: **`/api/admin`** (see [`src/routes/admin.routes.ts`](../src/routes/admin.routes.ts)).

## Pagination (list endpoints)

Query params:

| Param   | Default | Max | Description        |
|---------|---------|-----|--------------------|
| `page`  | 1       | —   | 1-based page       |
| `limit` | 20      | 100 | Page size          |

Response shape:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

List items include string **`id`** (Mongo `_id`) alongside **`_id`** for backward compatibility.

---

## `GET /stats`

Dashboard counters.

**200** body (example):

```json
{
  "userCount": 10,
  "vehicleCount": 5,
  "requestCount": 42,
  "pendingCount": 3,
  "requestsToday": 2,
  "activeMechanics": 4,
  "activeTowDrivers": 2
}
```

---

## `GET /users`

| Query    | Description                                                                 |
|----------|-------------------------------------------------------------------------------|
| `role`   | Filter: `owner` \| `mechanic` \| `tow` \| `admin`                           |
| `status` | Optional: `active` \| `suspended` (matches `User.status`)                   |
| `search` | Substring match on `email`, `displayName`, or `phoneNumber` (case-insensitive) |

Never returns `passwordHash`.

---

## `PATCH /users/:id`

Partial update. At least one field required.

| Field               | Type    | Notes                          |
|---------------------|---------|--------------------------------|
| `role`              | enum    | Same as `USER_ROLES`           |
| `displayName`       | string  | 1–120 chars                    |
| `phoneNumber`       | string  | nullable                       |
| `mechanicAvailable` | boolean | mechanics only (pool behavior) |
| `businessName`      | string  | nullable                       |
| `businessAddress`   | string  | nullable                       |
| `truckName`         | string  | nullable                       |
| `plateNumber`       | string  | nullable                       |
| `status`            | enum    | `active` \| `suspended` (suspend blocks login) |

Writes **`AdminAuditLog`** (`USER_UPDATE`).

---

## `DELETE /requests/:id`

Deletes a `ServiceRequest` by id. **204** empty body.

Writes **`AdminAuditLog`** (`REQUEST_DELETE`).

---

## `GET /pricing/tow` / `PATCH /pricing/tow`

Singleton config `PricingConfig` with `key: 'tow'`.

**PATCH** body: `{ "towPerKmLkr": number }` (non-negative).

Writes **`AdminAuditLog`** (`PRICING_UPDATE`).

---

## `GET /requests`

| Query    | Description                                                                 |
|----------|-----------------------------------------------------------------------------|
| `type`   | `roadside` \| `tow`                                                         |
| `status` | One of ServiceRequest statuses (e.g. `pending`, `completed`, `cancelled`)   |
| `from`   | ISO date start for `createdAt`                                              |
| `to`     | ISO date end for `createdAt`                                                |
| `search` | Case-insensitive match on userName, vehicle, issue, location, pickupAddress |

**Note:** Diagnoses live in **`DiagnosisHistory`**, not as `ServiceRequest.type`.

---

## `GET /requests/:id`

Single service request; **404** if missing.

---

## `GET /vehicles`

| Query     | Description                          |
|-----------|--------------------------------------|
| `ownerId` | Mongo ObjectId string of owner       |
| `search`  | `makeModel`, `vin`, or `label` match |

Populates `ownerId` with `email`, `displayName`, `phoneNumber`, `role` (no password hash).

---

## `GET /diagnoses`

| Query    | Description                                      |
|----------|--------------------------------------------------|
| `from`   | ISO start on `createdAt`                         |
| `to`     | ISO end on `createdAt`                           |
| `search` | diagnosis, symptoms, obdCode, vehicleLabel      |

Populates `userId` and `vehicleId` with safe projections.

---

## `GET /analytics`

Rate-limited (**40 req / 60s** per IP by default).

| Query | Default | Description              |
|-------|---------|--------------------------|
| `days` | 90     | Lookback window (max 366) |

Returns aggregates: requests by type/status, per-day series, completed count, diagnosis count in range, sum of `finalAmount` on completed requests (`estimatedRevenueLkr`). See response `meta.assumptions`.

---

## `GET /audit-logs`

Paginated **`AdminAuditLog`** entries, newest first, with `adminId` populated (`email`, `displayName`, `role`).

---

## `POST /seed-demo`

**Disabled** unless `ALLOW_ADMIN_SEED=true` (or `1`) in environment **and** `NODE_ENV` is not `production`.

If `ADMIN_SEED_CLEAR=true`, first deletes **all** `ServiceRequest`, `Vehicle`, `DiagnosisHistory`, `AdminAuditLog`, and **all users except `role: admin`** — destructive.

Then inserts demo owners, vehicles, requests, and one diagnosis.

Writes **`AdminAuditLog`** (`SEED_DEMO`).

---

## Public health

`GET /api/health` — no auth.

Auth: `POST /api/auth/login` — returns JWT; admin UI should reject non-admin `role` if login is restricted to operators only.
