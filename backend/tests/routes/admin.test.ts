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
    expect(res.body).toHaveProperty('requestsToday');
  });

  it('admin users list is paginated', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'adm@b.com', password: 'secret12', displayName: 'Adm', role: 'admin' });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('admin users list filters by status', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'adm4@b.com', password: 'secret12', displayName: 'Adm4', role: 'admin' });
    const active = await registerUser({ email: 'act@b.com', password: 'secret12', displayName: 'Act' });
    const suspended = await registerUser({ email: 'sus@b.com', password: 'secret12', displayName: 'Sus' });
    await request(app)
      .patch(`/api/admin/users/${suspended.user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'suspended' });

    const suspendedOnly = await request(app)
      .get('/api/admin/users?status=suspended')
      .set('Authorization', `Bearer ${token}`);
    expect(suspendedOnly.status).toBe(200);
    expect(suspendedOnly.body.total).toBe(1);
    expect(suspendedOnly.body.items[0].email).toBe('sus@b.com');

    const activeOnly = await request(app).get('/api/admin/users?status=active').set('Authorization', `Bearer ${token}`);
    expect(activeOnly.status).toBe(200);
    const emails = activeOnly.body.items.map((u: { email: string }) => u.email);
    expect(emails).toContain('adm4@b.com');
    expect(emails).toContain('act@b.com');
    expect(emails).not.toContain('sus@b.com');
  });

  it('admin users search matches phoneNumber', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'adm5@b.com', password: 'secret12', displayName: 'Adm5', role: 'admin' });
    await registerUser({
      email: 'phone@b.com',
      password: 'secret12',
      displayName: 'PhoneUser',
      phoneNumber: '+94771234567',
    });

    const res = await request(app).get('/api/admin/users?search=771234').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].email).toBe('phone@b.com');
  });

  it('admin can list requests', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'adm2@b.com', password: 'secret12', displayName: 'Adm2', role: 'admin' });
    const res = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('admin can list vehicles with populated owner', async () => {
    const app = buildApp();
    const { token: adminTok } = await registerUser({
      email: 'admveh@b.com',
      password: 'secret12',
      displayName: 'AdmVeh',
      role: 'admin',
    });
    const owner = await registerUser({
      email: 'ownveh@b.com',
      password: 'secret12',
      displayName: 'OwnerVeh',
      role: 'owner',
    });
    const vRes = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        label: 'Daily',
        makeModel: 'Toyota Aqua',
        make: 'Toyota',
        model: 'Aqua',
        year: 2018,
        vin: 'VINLIST123',
        plate: 'CAB-8833',
      });
    expect(vRes.status).toBe(201);
    const list = await request(app).get('/api/admin/vehicles').set('Authorization', `Bearer ${adminTok}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].vin).toBe('VINLIST123');
    expect(list.body.items[0].plate).toBe('CAB-8833');
    expect(list.body.items[0].year).toBe(2018);
    expect(list.body.items[0].ownerId).toBeDefined();
    const byOwnerSearch = await request(app)
      .get('/api/admin/vehicles?search=ownveh')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(byOwnerSearch.status).toBe(200);
    expect(byOwnerSearch.body.total).toBe(1);
  });

  it('admin can suspend a user and they cannot log in', async () => {
    const app = buildApp();
    const admin = await registerUser({ email: 'adm3@b.com', password: 'secret12', displayName: 'Adm3', role: 'admin' });
    const victim = await registerUser({ email: 'vic@b.com', password: 'secret12', displayName: 'Vic' });

    const patch = await request(app)
      .patch(`/api/admin/users/${victim.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'suspended' });
    expect(patch.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email: 'vic@b.com', password: 'secret12' });
    expect(login.status).toBe(403);
  });
});
