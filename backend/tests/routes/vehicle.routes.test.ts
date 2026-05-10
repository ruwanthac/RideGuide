import request from 'supertest';
import { buildApp } from '../../src/app';
import { registerUser } from '../../src/services/auth.service';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

async function auth() {
  const r = await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
  return r.token;
}

describe('vehicle routes', () => {
  it('create, list, update, delete', async () => {
    const app = buildApp();
    const token = await auth();
    const h = { Authorization: `Bearer ${token}` };

    const create = await request(app).post('/api/vehicles').set(h).send({
      label: 'Daily',
      makeModel: 'Toyota Camry 2020',
      vin: '1HGBH41JXMN109186',
      year: 2020,
      plate: 'CAB-1001',
    });
    expect(create.status).toBe(201);
    expect(create.body.ownerName).toBe('A');
    const id = create.body._id;

    const list = await request(app).get('/api/vehicles').set(h);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const update = await request(app).patch(`/api/vehicles/${id}`).set(h).send({ label: 'Weekend' });
    expect(update.status).toBe(200);
    expect(update.body.label).toBe('Weekend');

    const del = await request(app).delete(`/api/vehicles/${id}`).set(h);
    expect(del.status).toBe(204);

    const listAfter = await request(app).get('/api/vehicles').set(h);
    expect(listAfter.body).toHaveLength(0);
  });

  it('401 without token', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(401);
  });

  it('rejects a 4th vehicle for the same owner', async () => {
    const app = buildApp();
    const token = await auth();
    const h = { Authorization: `Bearer ${token}` };
    const base = {
      makeModel: 'Toyota Aqua',
      label: 'Car',
      year: 2019,
      plate: 'P',
    };
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/vehicles')
        .set(h)
        .send({
          ...base,
          vin: `VINVIN00${i}`,
          plate: `LK-${1000 + i}`,
          label: `Car ${i + 1}`,
        });
      expect(res.status).toBe(201);
    }
    const fourth = await request(app).post('/api/vehicles').set(h).send({
      label: 'Car 4',
      makeModel: 'Honda Fit',
      vin: 'FOUR444',
      year: 2022,
      plate: 'LK-9999',
    });
    expect(fourth.status).toBe(400);
    expect(String(fourth.body?.error ?? '')).toContain('at most');
  });
});
