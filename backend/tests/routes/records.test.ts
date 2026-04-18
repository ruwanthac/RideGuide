import request from 'supertest';
import { buildApp } from '../../src/app';
import { registerUser } from '../../src/services/auth.service';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

describe('vehicle records', () => {
  it('returns diagnoses + requests for a vehicle', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'o@b.com', password: 'secret12', displayName: 'O' });
    const h = { Authorization: `Bearer ${token}` };

    const v = await request(app).post('/api/vehicles').set(h)
      .send({ label: 'Daily', makeModel: 'Toyota', vin: 'X' });
    const vid = v.body._id;

    await request(app).post('/api/requests').set(h)
      .send({ type: 'roadside', vehicle: 'Toyota', vehicleId: vid, issue: 'flat', location: 'Main', latitude: 1, longitude: 2, phoneNumber: '1' });

    const res = await request(app).get(`/api/vehicles/${vid}/records`).set(h);
    expect(res.status).toBe(200);
    expect(res.body.vehicle._id).toBe(vid);
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.diagnoses).toEqual([]);
  });

  it('denies access to other users vehicles', async () => {
    const app = buildApp();
    const a = await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    const b = await registerUser({ email: 'b@b.com', password: 'secret12', displayName: 'B' });
    const v = await request(app).post('/api/vehicles').set('Authorization', `Bearer ${a.token}`)
      .send({ label: 'Daily', makeModel: 'Toyota', vin: 'X' });
    const res = await request(app).get(`/api/vehicles/${v.body._id}/records`).set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(403);
  });
});
