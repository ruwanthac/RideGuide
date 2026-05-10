# RideGuide admin dashboard

Vite + React SPA that talks to the **canonical RideGuide API** in [`../backend`](../backend) only over HTTP (JWT). There is **no** embedded server in this folder.

## Prerequisites

1. **Run the API** from the main backend (MongoDB required):

   ```bash
   cd ../backend
   cp .env.example .env   # if needed
   npm install && npm run dev
   ```

2. **CORS:** in `../backend/.env`, set `CORS_ORIGIN` to include this app’s origin, e.g. `http://localhost:5173` (Vite default) or comma-separated list. Use `*` only for local experimentation.

3. **Admin user:** log in with a user whose `role` is `admin` in MongoDB (same accounts as the mobile app admin flow).

## Configure

```bash
cp .env.example .env
# Edit .env — set VITE_API_BASE_URL to your API origin, or leave empty to use Vite proxy to VITE_PROXY_TARGET.
```

## Run

```bash
npm install
npm run dev
```

Open the printed local URL, sign in on `/login`.

## Build

```bash
npm run build
npm run preview
```

Point production `VITE_API_BASE_URL` at your deployed API (HTTPS).
