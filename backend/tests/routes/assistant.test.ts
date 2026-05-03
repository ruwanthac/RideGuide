process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      startChat: () => ({ sendMessage: jest.fn().mockResolvedValue({ response: { text: () => 'Check the battery.' } }) }),
    }),
  })),
}));

import request from 'supertest';
import { buildApp } from '../../src/app';
import { registerUser } from '../../src/services/auth.service';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);

describe('assistant', () => {
  it('returns a reply', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    const res = await request(app).post('/api/chat/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content: 'car wont start' }] });
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('battery');
    expect(typeof res.body.sessionId).toBe('string');
  });
});
