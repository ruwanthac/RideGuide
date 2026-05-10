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

  it('updates vehicle ownerName when display name changes', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'o@b.com', password: 'secret12', displayName: 'OldName' });
    const h = { Authorization: `Bearer ${token}` };
    const v = await request(app).post('/api/vehicles').set(h).send({
      label: 'X',
      makeModel: 'X',
      vin: 'XVINUSER1',
      year: 2015,
      plate: 'U-500',
    });
    expect(v.body.ownerName).toBe('OldName');

    await request(app).patch('/api/users/me').set(h).send({ displayName: 'NewName' });
    const list = await request(app).get('/api/vehicles').set(h);
    expect(list.body[0].ownerName).toBe('NewName');
  });
});
