import request from 'supertest';
import { buildApp } from '../../src/app';
import { registerUser } from '../../src/services/auth.service';
import { UserModel } from '../../src/models/User';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

describe('mechanics nearby', () => {
  it('returns mechanics within radius', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'o@b.com', password: 'secret12', displayName: 'O' });
    const m = await UserModel.create({
      email: 'm@b.com', passwordHash: 'x', displayName: 'M', role: 'mechanic',
      location: { type: 'Point', coordinates: [80.0, 6.9] },
    });
    await UserModel.create({
      email: 'far@b.com', passwordHash: 'x', displayName: 'Far', role: 'mechanic',
      location: { type: 'Point', coordinates: [0, 0] },
    });
    const res = await request(app).get('/api/mechanics/nearby?lat=6.9&lng=80.0&radiusKm=10')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((u: any) => u._id === String(m._id))).toBe(true);
    expect(res.body.some((u: any) => u.email === 'far@b.com')).toBe(false);
  });
});
