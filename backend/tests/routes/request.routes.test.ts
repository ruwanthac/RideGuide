import request from 'supertest';
import { buildApp } from '../../src/app';
import { registerUser } from '../../src/services/auth.service';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

describe('service requests', () => {
  it('owner posts, mechanic lists pending and accepts', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'o@b.com', password: 'secret12', displayName: 'Owner' });
    const mech = await registerUser({ email: 'm@b.com', password: 'secret12', displayName: 'Mech', role: 'mechanic' });

    const create = await request(app).post('/api/requests').set('Authorization', `Bearer ${owner.token}`)
      .send({ type: 'roadside', vehicle: 'Toyota', issue: 'Flat tyre', location: 'Main St', latitude: 1, longitude: 2, phoneNumber: '123' });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('pending');

    const list = await request(app).get('/api/requests').set('Authorization', `Bearer ${mech.token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const accept = await request(app).patch(`/api/requests/${create.body._id}`)
      .set('Authorization', `Bearer ${mech.token}`).send({ status: 'accepted' });
    expect(accept.status).toBe(200);
    expect(accept.body.status).toBe('accepted');
    expect(accept.body.acceptedBy).toBeTruthy();
  });
});

describe('service requests — vehicleId scoping', () => {
  it('owner can filter by vehicleId', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'o@b.com', password: 'secret12', displayName: 'O' });
    const h = { Authorization: `Bearer ${owner.token}` };

    const v1 = await request(app).post('/api/vehicles').set(h).send({ label: 'A', makeModel: 'A', vin: 'A' });
    const v2 = await request(app).post('/api/vehicles').set(h).send({ label: 'B', makeModel: 'B', vin: 'B' });

    await request(app).post('/api/requests').set(h)
      .send({ type: 'tow', vehicle: 'A', vehicleId: v1.body._id, issue: 'x', location: 'y', latitude: 0, longitude: 0, phoneNumber: '1' });
    await request(app).post('/api/requests').set(h)
      .send({ type: 'tow', vehicle: 'B', vehicleId: v2.body._id, issue: 'x', location: 'y', latitude: 0, longitude: 0, phoneNumber: '1' });

    const all = await request(app).get('/api/requests').set(h);
    expect(all.body).toHaveLength(2);

    const filtered = await request(app).get(`/api/requests?vehicleId=${v1.body._id}`).set(h);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].vehicleId).toBe(v1.body._id);
  });
});
