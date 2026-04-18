import express from 'express';
import request from 'supertest';
import { authRequired } from '../../src/middleware/authRequired';
import { roleGuard } from '../../src/middleware/roleGuard';
import { errorHandler } from '../../src/middleware/errorHandler';
import { registerUser } from '../../src/services/auth.service';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

function makeApp() {
  const app = express();
  app.get('/protected', authRequired, (req, res) => res.json({ userId: (req as any).user.userId }));
  app.get('/admin-only', authRequired, roleGuard(['admin']), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('auth middleware', () => {
  it('401s when no token', async () => {
    const res = await request(makeApp()).get('/protected');
    expect(res.status).toBe(401);
  });

  it('200s with a valid token', async () => {
    const { token } = await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    const res = await request(makeApp()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBeTruthy();
  });

  it('403s when role is wrong', async () => {
    const { token } = await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    const res = await request(makeApp()).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
