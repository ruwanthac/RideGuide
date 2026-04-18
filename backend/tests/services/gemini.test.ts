process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              likelyCauses: ['Oxygen sensor failure'],
              severity: 'moderate',
              steps: ['Check sensor wiring', 'Replace sensor', 'Clear codes'],
              diagnosis: 'The O2 sensor appears faulty.',
              disclaimer: 'Consult a mechanic for safety-critical issues.',
            }),
          },
        }),
        startChat: () => ({
          sendMessage: jest.fn().mockResolvedValue({ response: { text: () => 'Try checking your battery.' } }),
        }),
      }),
    })),
  };
});

import { analyzeDiagnosis, chatReply } from '../../src/services/gemini.client';

describe('gemini.client', () => {
  it('returns structured diagnosis', async () => {
    const r = await analyzeDiagnosis({ symptoms: 'rough idle', obdCode: 'P0131', vehicleMakeModel: 'Toyota' });
    expect(r.severity).toBe('moderate');
    expect(r.likelyCauses.length).toBeGreaterThan(0);
    expect(r.steps.length).toBeGreaterThan(0);
  });

  it('returns a text chat reply', async () => {
    const r = await chatReply([{ role: 'user', content: 'My car wont start' }]);
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  });
});
