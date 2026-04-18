import request from 'supertest';
import { buildApp } from '../src/app';

describe('GET /api/health', () => {
  it('returns ok=true', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
