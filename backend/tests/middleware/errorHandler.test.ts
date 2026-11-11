import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/errorHandler';
import { HttpError } from '../../src/services/auth.service';
import { toLiveCallError } from '../../src/utils/userFacingError';

function appThrowing(err: unknown) {
  const app = express();
  app.use(express.json());
  app.post('/boom', () => {
    throw err;
  });
  app.post('/form', (req, _res, next) => {
    try {
      z.object({ email: z.string().email(), password: z.string().min(8) }).parse(req.body);
    } catch (e) {
      next(e);
    }
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler user-facing messages', () => {
  const silence = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  afterAll(() => silence.mockRestore());

  it('hides the internals of unexpected errors', async () => {
    const res = await request(appThrowing(new TypeError("Cannot read properties of undefined (reading 'x')"))).post('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Something went wrong on our side. Please try again in a moment.');
  });

  it('turns AI provider failures into a plain message', async () => {
    const err = new Error('[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models: fetch failed');
    const res = await request(appThrowing(err)).post('/boom');
    expect(res.status).toBe(503);
    expect(res.body.error).not.toMatch(/google|https?:|fetch/i);
  });

  it('says the AI is busy when the quota is exhausted', async () => {
    const res = await request(appThrowing(new Error('[429 Too Many Requests] You exceeded your current quota'))).post('/boom');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/busy/i);
    expect(res.body.error).not.toMatch(/quota|billing|gemini/i);
  });

  it('keeps messages from expected errors', async () => {
    const res = await request(appThrowing(new HttpError(404, "We couldn't find that vehicle."))).post('/boom');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("We couldn't find that vehicle.");
  });

  it('describes invalid form fields in plain sentences', async () => {
    const res = await request(appThrowing(null)).post('/form').send({ email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please enter a valid email address. Your password must be at least 8 characters.');
  });
});

describe('toLiveCallError', () => {
  it('keeps the call going for connection blips and hides the details', () => {
    expect(toLiveCallError('Live voice session disconnected (1006: unknown).')).toEqual({
      message: expect.stringMatching(/reconnecting/i),
      transient: true,
    });
  });

  it('says nothing for internal mode switches', () => {
    expect(toLiveCallError('Live voice session unavailable. Using fallback voice processing.')).toBeNull();
  });

  it('still reports real failures from the fallback path', () => {
    const friendly = toLiveCallError('Fallback generateContent failed (400): {"error":{"code":400}}');
    expect(friendly).not.toBeNull();
    expect(friendly!.message).not.toMatch(/generateContent|400|\{/);
  });
});
