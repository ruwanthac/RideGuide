import request from 'supertest';
import { buildApp } from '../../src/app';
import { registerUser } from '../../src/services/auth.service';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

describe('users routes', () => {
  it('patches profile fields', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    const res = await request(app).patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'A2', role: 'mechanic', businessName: 'A-Auto', location: { lat: 1.5, lng: 2.5 } });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('A2');
    expect(res.body.role).toBe('owner');
    expect(res.body.businessName).toBe('A-Auto');
    expect(res.body.location.coordinates).toEqual([2.5, 1.5]);
  });
});
