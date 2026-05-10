import request from 'supertest';
import { buildApp } from '../../src/app';
import { registerUser, registerApprovedProvider } from '../../src/services/auth.service';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

describe('service requests', () => {
  it('dedupes create when idempotencyKey repeats', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'idem@b.com', password: 'secret12', displayName: 'Owner' });
    const h = { Authorization: `Bearer ${owner.token}` };
    const body = {
      type: 'roadside' as const,
      vehicle: 'Toyota',
      issue: 'Flat tyre',
      location: 'Main St',
      latitude: 1,
      longitude: 2,
      phoneNumber: '123',
      idempotencyKey: 'same-key-abc',
    };
    const a = await request(app).post('/api/requests').set(h).send(body);
    const b = await request(app).post('/api/requests').set(h).send(body);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body._id).toBe(b.body._id);

    const list = await request(app).get('/api/requests').set(h);
    expect(list.body).toHaveLength(1);
  });

  it('owner posts, mechanic lists pending and accepts', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'o@b.com', password: 'secret12', displayName: 'Owner' });
    const mech = await registerApprovedProvider({
      email: 'm@b.com',
      password: 'secret12',
      displayName: 'Mech',
      role: 'mechanic',
    });

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

    const towPayload = (vehicleId: string, vehicle: string) => ({
      type: 'tow' as const,
      vehicle,
      vehicleId,
      issue: 'x',
      location: 'Pickup',
      latitude: 0,
      longitude: 0,
      pickupAddress: 'Pickup',
      dropoffAddress: 'Dropoff',
      dropoffLatitude: 0.01,
      dropoffLongitude: 0.01,
      phoneNumber: '1',
    });

    const r1 = await request(app).post('/api/requests').set(h).send(towPayload(v1.body._id, 'A'));
    const r2 = await request(app).post('/api/requests').set(h).send(towPayload(v2.body._id, 'B'));
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    const all = await request(app).get('/api/requests').set(h);
    expect(all.body).toHaveLength(2);

    const filtered = await request(app).get(`/api/requests?vehicleId=${v1.body._id}`).set(h);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].vehicleId).toBe(v1.body._id);
  });
});

describe('service requests — tow lifecycle and estimate', () => {
  it('owner gets estimate and tow follows strict status order', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'tow-owner@b.com', password: 'secret12', displayName: 'Tow Owner' });
    const tow = await registerApprovedProvider({
      email: 'tow-driver@b.com',
      password: 'secret12',
      displayName: 'Tow Driver',
      role: 'tow',
    });

    const estimate = await request(app)
      .post('/api/requests/tow-estimate')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ pickupLatitude: 6.91, pickupLongitude: 79.86, dropoffLatitude: 6.93, dropoffLongitude: 79.88, bookingType: 'scheduled' });
    expect(estimate.status).toBe(200);
    expect(estimate.body.estimatedAmount).toBeGreaterThan(0);

    const create = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'tow',
        vehicle: 'Civic',
        issue: 'Tow requested',
        location: 'Pickup',
        latitude: 6.91,
        longitude: 79.86,
        pickupAddress: 'Pickup',
        dropoffAddress: 'Drop',
        phoneNumber: '123',
        bookingType: 'scheduled',
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
        estimatedAmount: estimate.body.estimatedAmount,
      });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('requested');

    const invalidSkip = await request(app)
      .patch(`/api/requests/${create.body._id}`)
      .set('Authorization', `Bearer ${tow.token}`)
      .send({ status: 'driver_on_the_way' });
    expect(invalidSkip.status).toBe(409);

    const picked = await request(app)
      .patch(`/api/requests/${create.body._id}`)
      .set('Authorization', `Bearer ${tow.token}`)
      .send({ status: 'driver_picked_hire' });
    expect(picked.status).toBe(200);
    expect(picked.body.acceptedBy).toBeTruthy();

    const onWay = await request(app)
      .patch(`/api/requests/${create.body._id}`)
      .set('Authorization', `Bearer ${tow.token}`)
      .send({ status: 'driver_on_the_way' });
    expect(onWay.status).toBe(200);
  });
});
