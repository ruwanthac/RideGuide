jest.mock('../../src/services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ ok: true, id: 'test-msg' }),
}));

import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { buildApp } from '../../src/app';
import { registerUser } from '../../src/services/auth.service';
import { sendEmail } from '../../src/services/email.service';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);

beforeEach(() => {
  clearDb();
  (sendEmail as jest.Mock).mockClear();
  (sendEmail as jest.Mock).mockResolvedValue({ ok: true, id: 'test-msg' });
  const pv = path.join(process.cwd(), 'uploads', 'provider-verification');
  try {
    fs.rmSync(pv, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  fs.mkdirSync(path.join(process.cwd(), 'uploads', 'tmp-register'), { recursive: true });
});

function tinyPng(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

describe('provider registration', () => {
  it('registers mechanic pending without token', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/register-provider')
      .field('email', 'mech@b.com')
      .field('displayName', 'M')
      .field('role', 'mechanic')
      .field('businessName', 'Shop')
      .field('businessAddress', '123 St')
      .attach('mechanicBrCopy', tinyPng(), 'br.png')
      .attach('mechanicNicCopy', tinyPng(), 'nic.png');
    expect(res.status).toBe(201);
    expect(res.body.pendingVerification).toBe(true);
    expect(res.body.user.providerVerificationStatus).toBe('pending');
    expect(res.body.token).toBeUndefined();

    const login = await request(app).post('/api/auth/login').send({ email: 'mech@b.com', password: 'secret1234' });
    expect(login.status).toBe(403);
  });

  it('admin verify enables login with OTP', async () => {
    const app = buildApp();
    const admin = await registerUser({ email: 'adm@b.com', password: 'secret12', displayName: 'A', role: 'admin' });

    const reg = await request(app)
      .post('/api/auth/register-provider')
      .field('email', 'tow@b.com')
      .field('displayName', 'T')
      .field('role', 'tow')
      .field('businessName', 'Co')
      .field('truckName', 'Big')
      .field('plateNumber', 'ABC123')
      .attach('towCompanyBrCopy', tinyPng(), 'b.png')
      .attach('towCompanyNicCopy', tinyPng(), 'n.png')
      .attach('towTruckRegCopy', tinyPng(), 'r.png')
      .attach('towTruckNicCopy', tinyPng(), 't.png');
    expect(reg.status).toBe(201);
    const userId = reg.body.user.id ?? reg.body.user._id;

    const verify = await request(app)
      .post(`/api/admin/users/${userId}/verify-provider`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(verify.status).toBe(200);

    const badOld = await request(app).post('/api/auth/login').send({ email: 'tow@b.com', password: 'secret1234' });
    expect(badOld.status).toBe(401);

    expect(sendEmail).toHaveBeenCalled();
    const html = (sendEmail as jest.Mock).mock.calls[0][0].html as string;
    const otpMatch = html.match(/<code[^>]*>([^<]+)<\/code>/);
    expect(otpMatch).toBeTruthy();
    const otp = otpMatch![1].trim();

    const login = await request(app).post('/api/auth/login').send({ email: 'tow@b.com', password: otp });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    expect(login.body.user.mustChangePassword).toBe(true);
  });
});
