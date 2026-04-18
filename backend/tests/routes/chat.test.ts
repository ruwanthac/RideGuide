import request from 'supertest';
import { buildApp } from '../../src/app';
import { registerUser } from '../../src/services/auth.service';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

describe('chat history via REST', () => {
  it('denies non-members', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'o@b.com', password: 'secret12', displayName: 'O' });
    const stranger = await registerUser({ email: 's@b.com', password: 'secret12', displayName: 'S' });
    const r = await request(app).post('/api/requests').set('Authorization', `Bearer ${owner.token}`)
      .send({ type: 'roadside', vehicle: 'v', issue: 'i', location: 'l', latitude: 0, longitude: 0, phoneNumber: '1' });
    const res = await request(app).get(`/api/requests/${r.body._id}/messages`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(res.status).toBe(403);
  });

  it('returns empty array for member with no messages yet', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'o@b.com', password: 'secret12', displayName: 'O' });
    const r = await request(app).post('/api/requests').set('Authorization', `Bearer ${owner.token}`)
      .send({ type: 'roadside', vehicle: 'v', issue: 'i', location: 'l', latitude: 0, longitude: 0, phoneNumber: '1' });
    const res = await request(app).get(`/api/requests/${r.body._id}/messages`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
