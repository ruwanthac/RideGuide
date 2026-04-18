import { registerUser, loginUser, verifyToken } from '../../src/services/auth.service';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

describe('auth.service', () => {
  it('registers and returns user + token', async () => {
    const r = await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    expect(r.user.email).toBe('a@b.com');
    expect(r.token).toMatch(/^eyJ/);
    expect((r.user as any).passwordHash).toBeUndefined();
  });

  it('rejects duplicate email', async () => {
    await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    await expect(
      registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'B' })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('logs in with correct password', async () => {
    await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    const r = await loginUser({ email: 'a@b.com', password: 'secret12' });
    expect(r.token).toMatch(/^eyJ/);
  });

  it('rejects wrong password', async () => {
    await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    await expect(
      loginUser({ email: 'a@b.com', password: 'wrong1234' })
    ).rejects.toMatchObject({ status: 401 });
  });

  it('round-trips a token', async () => {
    const r = await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    const payload = verifyToken(r.token);
    expect(payload.userId).toBe(String(r.user._id));
    expect(payload.role).toBe('owner');
  });
});
