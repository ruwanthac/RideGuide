import mongoose from 'mongoose';
import { UserModel } from '../../src/models/User';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

describe('UserModel', () => {
  it('saves with defaults', async () => {
    const u = await UserModel.create({
      email: 'a@b.com',
      passwordHash: 'x',
      displayName: 'A',
    });
    expect(u.role).toBe('owner');
    expect(u.email).toBe('a@b.com');
    expect(u.createdAt).toBeInstanceOf(Date);
  });

  it('enforces unique email', async () => {
    await UserModel.create({ email: 'a@b.com', passwordHash: 'x', displayName: 'A' });
    await expect(
      UserModel.create({ email: 'a@b.com', passwordHash: 'y', displayName: 'B' })
    ).rejects.toThrow();
  });

  it('rejects invalid role', async () => {
    const u = new UserModel({
      email: 'a@b.com',
      passwordHash: 'x',
      displayName: 'A',
      role: 'banana' as any,
    });
    await expect(u.validate()).rejects.toThrow();
  });
});
