import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { env } from '../config/env';

const diagnosisSchema = z.object({
  likelyCauses: z.array(z.string()).min(1).max(6),
  severity: z.enum(['minor', 'moderate', 'critical']),
  steps: z.array(z.string()).min(1).max(10),
  diagnosis: z.string().min(1),
  disclaimer: z.string().min(1),
});

export type DiagnosisResult = z.infer<typeof diagnosisSchema>;

function getClient() {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

const DIAGNOSIS_SYSTEM = `You are an automotive diagnostic assistant. Return strictly valid JSON with fields:
likelyCauses: string[] (1-4), severity: 'minor'|'moderate'|'critical', steps: string[] (3-7 non-technical inspection/repair steps),
diagnosis: one-paragraph plain-English summary, disclaimer: short safety note. Do not invent part numbers.`;

const CHAT_SYSTEM = `You are a vehicle-support assistant. Keep replies concise, practical, non-technical.
Only discuss vehicle diagnosis, maintenance, and roadside advice. If off-topic, politely redirect.`;

export async function analyzeDiagnosis(input: { symptoms: string; obdCode: string; vehicleMakeModel: string }): Promise<DiagnosisResult> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: DIAGNOSIS_SYSTEM,
  });

  const prompt = JSON.stringify(input);

  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await model.generateContent(prompt);
    const text = r.response.text();
    try {
      return diagnosisSchema.parse(JSON.parse(text));
    } catch {
      if (attempt === 1) throw new Error('AI returned malformed diagnosis');
    }
  }
  throw new Error('AI returned malformed diagnosis');
}

export async function chatReply(messages: { role: 'user' | 'model'; content: string }[]): Promise<string> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: CHAT_SYSTEM });
  const history = messages.slice(0, -1).map(m => ({ role: m.role, parts: [{ text: m.content }] }));
  while (history.length && history[0].role !== 'user') history.shift();
  const last = messages[messages.length - 1];
  if (last.role !== 'user') throw new Error('last message must be from user');
  const chat = model.startChat({ history });
  const r = await chat.sendMessage(last.content);
  return r.response.text();
}
