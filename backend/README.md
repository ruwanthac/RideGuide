# RideGuide Backend

Node.js + Express + Socket.IO + MongoDB (Mongoose) API for the RideGuide mobile app.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the server with hot-reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server (`dist/server.js`) |
| `npm test` | Run Jest suite (in-memory Mongo) |
| `npm run typecheck` | `tsc --noEmit` |

## Layout

```
src/
├── server.ts                boots http server + sockets + mongo
├── app.ts                   buildApp() — express factory
├── config/                  env.ts (zod), db.ts (mongoose)
├── middleware/              authRequired, roleGuard, errorHandler
├── models/                  User, Vehicle, DiagnosisHistory, ServiceRequest, ChatMessage
├── services/                business logic (auth, user, vehicle, diagnosis, request, chat, mechanic, admin, gemini.client)
├── controllers/             thin HTTP handlers (zod-validated)
├── routes/                  Express routers (mounted under /api)
└── sockets/                 Socket.IO (JWT handshake, chat rooms, request emissions)

tests/
├── helpers/mongo.ts         mongodb-memory-server helpers
├── models/                  model unit tests
├── services/                service unit tests (Gemini mocked)
├── middleware/              middleware tests
└── routes/                  integration tests via supertest
```

## Environment

See root `README.md` for env var list. `.env` is gitignored; copy `.env.example` and fill in values.

## Testing

All tests run against an in-memory MongoDB via `mongodb-memory-server` — no Atlas connection required. Gemini API calls are mocked in every test that touches the client.

Current count: **27 tests, 14 suites**.
