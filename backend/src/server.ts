import http from 'http';
import { buildApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { removeExpiredOpenRequests } from './services/request.service';
import { attachSockets } from './sockets';

const EXPIRED_REQUEST_SWEEP_MS = 60_000;

async function main() {
  await connectDb();
  const app = buildApp();
  const server = http.createServer(app);
  attachSockets(server);
  server.listen(env.PORT, () => {
    console.log(`[ride-guide] listening on :${env.PORT} (${env.NODE_ENV})`);
  });
  if (env.NODE_ENV !== 'test') {
    setInterval(() => {
      void removeExpiredOpenRequests().catch((err) =>
        console.error('[ride-guide] expired open requests sweep:', err),
      );
    }, EXPIRED_REQUEST_SWEEP_MS);
    void removeExpiredOpenRequests().catch((err) =>
      console.error('[ride-guide] initial expired open requests sweep:', err),
    );
  }
}

main().catch((err) => {
  console.error('[ride-guide] fatal on boot:', err);
  process.exit(1);
});
