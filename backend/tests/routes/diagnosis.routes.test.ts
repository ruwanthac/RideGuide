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
import { registerUser, registerApprovedProvider } from '../../src/services/auth.service';
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
    expect(diag.body.userName).toBe('A');

    const hist = await request(app).get('/api/diagnosis-history').set(h);
    expect(hist.status).toBe(200);
    expect(hist.body).toHaveLength(1);
  });

  it('creates diagnosis with manual vehicle (no saved vehicle)', async () => {
    const app = buildApp();
    const { token } = await registerApprovedProvider({
      email: 'mech@b.com',
      password: 'secret12',
      displayName: 'Mech',
      role: 'mechanic',
    });
    const h = { Authorization: `Bearer ${token}` };

    const diag = await request(app)
      .post('/api/diagnosis')
      .set(h)
      .send({
        symptoms: 'rough idle',
        obdCode: 'P0300',
        vehicleMakeModel: '2018 Ford F-150',
        vehicleVin: '1FTFW1ET4EFA12345',
      });
    expect(diag.status).toBe(201);
    expect(diag.body.vehicleLabel).toBe('2018 Ford F-150');
    expect(diag.body.vehicleId).toBeFalsy();
  });
});
