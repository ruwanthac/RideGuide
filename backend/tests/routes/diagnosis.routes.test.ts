process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            likelyCauses: ['Battery weak'],
            severity: 'minor',
            steps: ['Check battery voltage', 'Clean terminals', 'Test alternator'],
            diagnosis: 'Likely a weak battery.',
            disclaimer: 'If unsure, see a mechanic.',
          }),
        },
      }),
      startChat: () => ({ sendMessage: jest.fn().mockResolvedValue({ response: { text: () => 'Hello' } }) }),
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

describe('diagnosis', () => {
  it('creates + lists history', async () => {
    const app = buildApp();
    const { token } = await registerUser({ email: 'a@b.com', password: 'secret12', displayName: 'A' });
    const h = { Authorization: `Bearer ${token}` };

    const v = await request(app).post('/api/vehicles').set(h)
      .send({ label: 'Daily', makeModel: 'Toyota Camry', vin: 'X' });

    const diag = await request(app).post('/api/diagnosis').set(h)
      .send({ symptoms: 'slow crank', obdCode: '', vehicleId: v.body._id });
    expect(diag.status).toBe(201);
    expect(diag.body.severity).toBe('minor');

    const hist = await request(app).get('/api/diagnosis-history').set(h);
    expect(hist.status).toBe(200);
    expect(hist.body).toHaveLength(1);
  });
});
