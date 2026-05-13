import request from 'supertest';
import { buildApp } from '../../src/app';
import { ServiceRequestModel } from '../../src/models/ServiceRequest';
import { registerUser, registerApprovedProvider } from '../../src/services/auth.service';
import { removeExpiredOpenRequests } from '../../src/services/request.service';
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

    await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${mech.token}`)
      .send({ location: { lat: 1, lng: 2 } });

    const list = await request(app).get('/api/requests').set('Authorization', `Bearer ${mech.token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const accept = await request(app).patch(`/api/requests/${create.body._id}`)
      .set('Authorization', `Bearer ${mech.token}`).send({ status: 'accepted' });
    expect(accept.status).toBe(200);
    expect(accept.body.status).toBe('accepted');
    expect(accept.body.acceptedBy).toBeTruthy();
  });

  it('only one mechanic wins when two try to accept the same job', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'o-race@b.com', password: 'secret12', displayName: 'Owner' });
    const m1 = await registerApprovedProvider({
      email: 'm1-race@b.com',
      password: 'secret12',
      displayName: 'M1',
      role: 'mechanic',
    });
    const m2 = await registerApprovedProvider({
      email: 'm2-race@b.com',
      password: 'secret12',
      displayName: 'M2',
      role: 'mechanic',
    });

    const create = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'roadside',
        vehicle: 'Toyota',
        issue: 'Flat tyre',
        location: 'Main St',
        latitude: 1,
        longitude: 2,
        phoneNumber: '123',
      });
    expect(create.status).toBe(201);

    await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${m1.token}`)
      .send({ location: { lat: 1, lng: 2 } });
    await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${m2.token}`)
      .send({ location: { lat: 1, lng: 2 } });

    const [a, b] = await Promise.all([
      request(app)
        .patch(`/api/requests/${create.body._id}`)
        .set('Authorization', `Bearer ${m1.token}`)
        .send({ status: 'accepted' }),
      request(app)
        .patch(`/api/requests/${create.body._id}`)
        .set('Authorization', `Bearer ${m2.token}`)
        .send({ status: 'accepted' }),
    ]);
    const winners = [a, b].filter((r) => r.status === 200);
    const losers = [a, b].filter((r) => r.status === 409);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
  });

  it('only one tow driver wins when two try to pick the same hire', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'o-tow-race@b.com', password: 'secret12', displayName: 'Tow Owner' });
    const t1 = await registerApprovedProvider({
      email: 't1-race@b.com',
      password: 'secret12',
      displayName: 'Tow1',
      role: 'tow',
    });
    const t2 = await registerApprovedProvider({
      email: 't2-race@b.com',
      password: 'secret12',
      displayName: 'Tow2',
      role: 'tow',
    });

    const create = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'tow',
        vehicle: 'Civic',
        issue: 'Tow',
        location: 'Pickup',
        latitude: 6.91,
        longitude: 79.86,
        pickupAddress: 'Pickup',
        dropoffAddress: 'Drop',
        dropoffLatitude: 6.93,
        dropoffLongitude: 79.88,
        phoneNumber: '123',
      });
    expect(create.status).toBe(201);

    await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${t1.token}`)
      .send({ location: { lat: 6.91, lng: 79.86 } });
    await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${t2.token}`)
      .send({ location: { lat: 6.91, lng: 79.86 } });

    const [a, b] = await Promise.all([
      request(app)
        .patch(`/api/requests/${create.body._id}`)
        .set('Authorization', `Bearer ${t1.token}`)
        .send({ status: 'driver_picked_hire' }),
      request(app)
        .patch(`/api/requests/${create.body._id}`)
        .set('Authorization', `Bearer ${t2.token}`)
        .send({ status: 'driver_picked_hire' }),
    ]);
    const winners = [a, b].filter((r) => r.status === 200);
    const losers = [a, b].filter((r) => r.status === 409);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
  });

  it('mechanic with live location only sees pending jobs within providerMatchRadiusKm', async () => {
    const app = buildApp();
    const admin = await registerUser({
      email: 'adm-radius@b.com',
      password: 'secret12',
      displayName: 'AdminR',
      role: 'admin',
    });
    const patchPricing = await request(app)
      .patch('/api/admin/pricing/tow')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ towPerKmLkr: 320, providerMatchRadiusKm: 8 });
    expect(patchPricing.status).toBe(200);

    const owner = await registerUser({ email: 'own-radius@b.com', password: 'secret12', displayName: 'OwnR' });
    const mechNear = await registerApprovedProvider({
      email: 'mech-near@b.com',
      password: 'secret12',
      displayName: 'Near',
      role: 'mechanic',
    });
    const mechFar = await registerApprovedProvider({
      email: 'mech-far@b.com',
      password: 'secret12',
      displayName: 'Far',
      role: 'mechanic',
    });

    const jobLat = 6.9;
    const jobLng = 79.99;
    const create = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'roadside',
        vehicle: 'Toyota',
        issue: 'Flat',
        location: 'Here',
        latitude: jobLat,
        longitude: jobLng,
        phoneNumber: '1',
      });
    expect(create.status).toBe(201);

    await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${mechNear.token}`)
      .send({ location: { lat: 6.901, lng: jobLng } });
    const listNear = await request(app).get('/api/requests').set('Authorization', `Bearer ${mechNear.token}`);
    expect(listNear.status).toBe(200);
    expect(listNear.body).toHaveLength(1);

    await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${mechFar.token}`)
      .send({ location: { lat: 7.25, lng: jobLng } });
    const listFar = await request(app).get('/api/requests').set('Authorization', `Bearer ${mechFar.token}`);
    expect(listFar.status).toBe(200);
    expect(listFar.body).toHaveLength(0);
  });
});

describe('service requests — vehicleId scoping', () => {
  it('owner can filter by vehicleId', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'o@b.com', password: 'secret12', displayName: 'O' });
    const h = { Authorization: `Bearer ${owner.token}` };

    const v1 = await request(app).post('/api/vehicles').set(h).send({
      label: 'A',
      makeModel: 'A',
      vin: 'AVIN12345',
      year: 2019,
      plate: 'REQ-A1',
    });
    const v2 = await request(app).post('/api/vehicles').set(h).send({
      label: 'B',
      makeModel: 'B',
      vin: 'BVIN67890',
      year: 2020,
      plate: 'REQ-B2',
    });

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

    await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tow.token}`)
      .send({ location: { lat: 6.91, lng: 79.86 } });

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

  it('assigns expiresAt on new open requests (default window)', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'exp-at@b.com', password: 'secret12', displayName: 'OwnerExp' });
    const create = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'roadside',
        vehicle: 'Toyota',
        issue: 'Flat',
        location: 'Main St',
        latitude: 1,
        longitude: 2,
        phoneNumber: '123',
      });
    expect(create.status).toBe(201);
    expect(create.body.expiresAt).toBeTruthy();
    const exp = new Date(create.body.expiresAt).getTime();
    const minAt = Date.now() + 28 * 60 * 1000;
    const maxAt = Date.now() + 33 * 60 * 1000;
    expect(exp).toBeGreaterThanOrEqual(minAt);
    expect(exp).toBeLessThanOrEqual(maxAt);
  });

  it('removeExpiredOpenRequests deletes unclaimed expired pool jobs', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'sweep@b.com', password: 'secret12', displayName: 'OwnerSweep' });
    const create = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'roadside',
        vehicle: 'Toyota',
        issue: 'Flat',
        location: 'Main St',
        latitude: 1,
        longitude: 2,
        phoneNumber: '123',
      });
    expect(create.status).toBe(201);
    const id = create.body._id as string;
    await ServiceRequestModel.findByIdAndUpdate(id, { $set: { expiresAt: new Date(Date.now() - 60_000) } });
    const n = await removeExpiredOpenRequests();
    expect(n).toBe(1);
    const list = await request(app).get('/api/requests').set('Authorization', `Bearer ${owner.token}`);
    expect(list.body.some((r: { _id: string }) => r._id === id)).toBe(false);
  });

  it('removeExpiredOpenRequests does not delete accepted jobs', async () => {
    const app = buildApp();
    const owner = await registerUser({ email: 'sweep-ok@b.com', password: 'secret12', displayName: 'OwnerOk' });
    const mech = await registerApprovedProvider({
      email: 'sweep-m@b.com',
      password: 'secret12',
      displayName: 'MechOk',
      role: 'mechanic',
    });
    const create = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'roadside',
        vehicle: 'Toyota',
        issue: 'Flat',
        location: 'Main St',
        latitude: 1,
        longitude: 2,
        phoneNumber: '123',
      });
    expect(create.status).toBe(201);
    const id = create.body._id as string;
    await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${mech.token}`)
      .send({ location: { lat: 1, lng: 2 } });
    const accept = await request(app)
      .patch(`/api/requests/${id}`)
      .set('Authorization', `Bearer ${mech.token}`)
      .send({ status: 'accepted' });
    expect(accept.status).toBe(200);
    await ServiceRequestModel.findByIdAndUpdate(id, { $set: { expiresAt: new Date(Date.now() - 60_000) } });
    const n = await removeExpiredOpenRequests();
    expect(n).toBe(0);
    const still = await ServiceRequestModel.findById(id).lean();
    expect(still).toBeTruthy();
  });
});
