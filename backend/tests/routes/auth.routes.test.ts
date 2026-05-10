import request from 'supertest';
import { buildApp } from '../../src/app';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

describe('auth routes', () => {
  it('registers, logs in, fetches me', async () => {
    const app = buildApp();

    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeTruthy();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'secret12' });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('a@b.com');
  });

  it('rejects bad login with 401', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/login').send({ email: 'x@y.com', password: 'nope12345' });
    expect(res.status).toBe(401);
  });

  it('rejects JSON register when role is not owner', async () => {
    const app = buildApp();
    const bad = await request(app)
      .post('/api/auth/register')
      .send({ email: 'mech2@b.com', password: 'secret12', displayName: 'M', role: 'mechanic' });
    expect(bad.status).toBe(400);
  });

  it('rejects admin role on public register', async () => {
    const app = buildApp();
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad@b.com', password: 'secret12', displayName: 'X', role: 'admin' });
    expect(reg.status).toBe(400);
  });

  it('changes password for authenticated user', async () => {
    const app = buildApp();
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'cp@b.com', password: 'secret12', displayName: 'CP' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cp@b.com', password: 'secret12' });
    expect(login.status).toBe(200);

    const change = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ password: 'newsecret12' });
    expect(change.status).toBe(200);
    expect(change.body.ok).toBe(true);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cp@b.com', password: 'secret12' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cp@b.com', password: 'newsecret12' });
    expect(newLogin.status).toBe(200);
  });
});
