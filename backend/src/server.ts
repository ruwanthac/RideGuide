import http from 'http';
import { buildApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { attachSockets } from './sockets';

async function main() {
  await connectDb();
  const app = buildApp();
  const server = http.createServer(app);
  attachSockets(server);
  server.listen(env.PORT, () => {
    console.log(`[ride-guide] listening on :${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('[ride-guide] fatal on boot:', err);
  process.exit(1);
});
