process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

const generateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent }),
  })),
}));

import request from 'supertest';
import { buildApp } from '../../src/app';
import { registerUser } from '../../src/services/auth.service';
import { DiagnosisHistoryModel } from '../../src/models/DiagnosisHistory';
import { startInMemoryMongo, stopInMemoryMongo, clearDb } from '../helpers/mongo';

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
afterEach(clearDb);
beforeEach(() => generateContent.mockReset());

const aiReplies = (body: object) =>
  generateContent.mockResolvedValue({ response: { text: () => JSON.stringify(body) } });

const validDiagnosis = {
  relevant: true,
  likelyCauses: ['Worn drive belt'],
  severity: 'minor',
  steps: ['Inspect the belt', 'Check tension', 'Replace if cracked'],
  diagnosis: 'Likely a worn serpentine belt.',
  disclaimer: 'See a mechanic if unsure.',
};

async function owner() {
  const { token } = await registerUser({ email: 'o@b.com', password: 'secret12', displayName: 'O' });
  return { Authorization: `Bearer ${token}` };
}

describe('diagnosis relevance', () => {
  it('refuses symptoms that are not a vehicle problem and saves nothing', async () => {
    const h = await owner();
    aiReplies({ relevant: false, offTopicField: 'symptoms' });
    const res = await request(buildApp())
      .post('/api/diagnosis')
      .set(h)
      .send({ symptoms: 'how do I cook rice', obdCode: '', vehicleMakeModel: 'Toyota Axio' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/doesn't sound like a vehicle problem/);
    expect(await DiagnosisHistoryModel.countDocuments()).toBe(0);
  });

  it('names the vehicle field when the make and model is not a vehicle', async () => {
    const h = await owner();
    aiReplies({ relevant: false, offTopicField: 'vehicle' });
    const res = await request(buildApp())
      .post('/api/diagnosis')
      .set(h)
      .send({ symptoms: 'squeaking noise', obdCode: '', vehicleMakeModel: 'banana smoothie' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/make and model/);
  });

  it('rejects an invalid OBD code without asking the AI', async () => {
    const h = await owner();
    const res = await request(buildApp())
      .post('/api/diagnosis')
      .set(h)
      .send({ symptoms: '', obdCode: 'hello', vehicleMakeModel: 'Toyota Axio' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/OBD code/);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('rejects text that cannot be a VIN or chassis number', async () => {
    const h = await owner();
    const res = await request(buildApp())
      .post('/api/diagnosis')
      .set(h)
      .send({ symptoms: 'engine knocking', obdCode: '', vehicleMakeModel: 'Toyota Axio', vehicleVin: 'my car is blue' });
    expect(res.status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('diagnoses real problems, including several OBD codes and a Japanese chassis number', async () => {
    const h = await owner();
    aiReplies(validDiagnosis);
    const res = await request(buildApp())
      .post('/api/diagnosis')
      .set(h)
      .send({ symptoms: 'squeal on cold start', obdCode: 'p0171, P0174', vehicleMakeModel: 'Toyota Axio', vehicleVin: 'NZE141-1234567' });
    expect(res.status).toBe(201);
    expect(res.body.obdCode).toBe('P0171, P0174');
    expect(await DiagnosisHistoryModel.countDocuments()).toBe(1);
  });
});
