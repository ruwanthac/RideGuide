import request from 'supertest';
import { buildApp } from '../../src/app';
import { registerUser } from '../../src/services/auth.service';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

describe('admin', () => {
  it('stats require admin role', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'o@b.com', password: 'secret12', displayName: 'O' });
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('admin can read stats', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A', role: 'admin' });
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userCount');
  });
});
