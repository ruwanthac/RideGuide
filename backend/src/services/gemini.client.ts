import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { env } from '../config/env';
import { HttpError } from './auth.service';
import { AI_BUSY_MESSAGE, AI_FAILED_MESSAGE } from '../utils/userFacingError';

const diagnosisSchema = z.object({
  likelyCauses: z.array(z.string()).min(1).max(6),
  severity: z.enum(['minor', 'moderate', 'critical']),
  steps: z.array(z.string()).min(1).max(10),
  diagnosis: z.string().min(1),
  /** 1-2 plain sentences for the owner: what's wrong and how urgent. Optional so older replies still parse. */
  summary: z.string().min(1).max(400).optional(),
  disclaimer: z.string().min(1),
});

export type DiagnosisResult = z.infer<typeof diagnosisSchema>;

/** The model's verdict on whether the input is a real vehicle problem; missing means relevant (older replies). */
const relevanceSchema = z.object({
  relevant: z.boolean().default(true),
  offTopicField: z.enum(['symptoms', 'vehicle', 'obdCode']).nullish(),
});

const OFF_TOPIC_MESSAGES: Record<'symptoms' | 'vehicle' | 'obdCode', string> = {
  symptoms:
    "That doesn't sound like a vehicle problem. Please describe what's wrong with your vehicle, for example \"engine makes a knocking sound when accelerating\".",
  vehicle: "That doesn't look like a vehicle make and model. Please enter something like \"2016 Toyota Axio\".",
  obdCode: "That doesn't look like an OBD code. Codes look like P0420 or C1234.",
};

function isQuotaExceededError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('quota exceeded') ||
    message.includes('too many requests') ||
    message.includes('rate limit')
  );
}

function getClient() {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenerativeAI(env.GEMINI_API_KEY);
}
const CHEAP_MODEL = env.GEMINI_MODEL_CHEAP;

const DIAGNOSIS_SYSTEM = `You are an automotive diagnostic assistant. Return strictly valid JSON.

Step 1 - relevance check (always do this first):
Set "relevant" to false when the input is not a real vehicle problem, and say which field is the reason in "offTopicField":
- "symptoms": the description is not about a vehicle (e.g. cooking, homework, health, greetings, jokes, random letters or keyboard mashing).
- "vehicle": vehicleMakeModel is not a vehicle (e.g. a person, food, a phone, gibberish).
- "obdCode": the code is clearly not a vehicle diagnostic code.
Short or vague vehicle complaints ("car won't start", "noise from wheel", "check engine light"), symptoms in Sinhala, and
an OBD code with no symptoms ARE relevant. When relevant is false, return only {"relevant": false, "offTopicField": "..."}.

Step 2 - when relevant is true, also return:
likelyCauses: string[] (1-4), severity: 'minor'|'moderate'|'critical', steps: string[] (3-7 non-technical inspection/repair steps),
diagnosis: one-paragraph plain-English explanation,
summary: what is wrong and what to do now, for the car owner, in at most 25 words and 2 short sentences, no jargon
(e.g. "Cylinder 1 is misfiring. A flashing check engine light can damage the catalytic converter, so avoid long drives."),
disclaimer: short safety note. Do not invent part numbers.`;

const CHAT_SYSTEM = `You are a vehicle-support assistant. Keep replies concise, practical, and appropriate for voice when relevant.
Only discuss vehicle diagnosis, maintenance, and roadside advice. If off-topic, politely redirect in the user's language.
When the user attaches a vehicle photo, use it carefully: identify make/model/trim if visible, note body style and era, and answer questions (for example horsepower) using visible badges or your best reasonable estimate for that generation—say when you are estimating vs reading a badge.
Language: If the user writes in Sinhala (සිංහල), reply entirely in Sinhala. If they write in English, reply in English. Never claim you cannot use Sinhala.
If a captured image is not vehicle-related, ignore that image silently and continue answering the user's conversation.
If a captured image is vehicle-related, use visible vehicle cues to improve diagnosis and identify likely model details when clear.`;

export async function analyzeDiagnosis(input: {
  symptoms: string;
  obdCode: string;
  vehicleMakeModel: string;
  vehicleVin?: string | null;
}): Promise<DiagnosisResult> {
  try {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: CHEAP_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
      systemInstruction: DIAGNOSIS_SYSTEM,
    });

    const prompt = JSON.stringify({
      symptoms: input.symptoms || '(none provided)',
      obdCode: input.obdCode || '(none provided)',
      vehicleMakeModel: input.vehicleMakeModel,
      vehicleVin: input.vehicleVin?.trim() || null,
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await model.generateContent(prompt);
      let parsed: unknown;
      try {
        parsed = JSON.parse(r.response.text());
      } catch {
        continue;
      }
      const relevance = relevanceSchema.safeParse(parsed);
      if (relevance.success && !relevance.data.relevant) {
        // Off-topic input is refused (and never saved) rather than "diagnosed".
        throw new HttpError(422, OFF_TOPIC_MESSAGES[relevance.data.offTopicField ?? 'symptoms']);
      }
      const diagnosis = diagnosisSchema.safeParse(parsed);
      if (diagnosis.success) return diagnosis.data;
    }
    throw new HttpError(502, AI_FAILED_MESSAGE);
  } catch (err) {
    // Not saved to history: the error reaches the user as a plain "try again" message.
    if (isQuotaExceededError(err)) throw new HttpError(503, AI_BUSY_MESSAGE);
    throw err;
  }
}

const SUMMARIZE_CALL_SYSTEM = `You summarize a short vehicle-related AI video/voice chat for the car owner.
Output plain text only: 2–6 short sentences or bullet lines. Focus on what the user asked, symptoms, and advice given. No markdown headings.
Use the same language as the conversation: if the user mainly used Sinhala (සිංහල), write the entire summary in Sinhala; if mainly English, use English.`;

export async function summarizeAiCallMessages(
  turns: { role: 'user' | 'model'; content: string }[]
): Promise<string> {
  if (!turns.length) return '';
  if (!env.GEMINI_API_KEY) return '';
  try {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: CHEAP_MODEL,
      systemInstruction: SUMMARIZE_CALL_SYSTEM,
    });
    const transcript = turns
      .map((t) => `${t.role}: ${t.content}`)
      .join('\n')
      .slice(0, 14000);
    const r = await model.generateContent(
      `Summarize this conversation transcript for the owner's history:\n\n${transcript}`
    );
    return r.response.text().trim();
  } catch (err) {
    if (isQuotaExceededError(err)) {
      return 'Video call with the Vehicle Expert (summary not available).';
    }
    throw err;
  }
}

export type ChatApiMessage = {
  role: 'user' | 'model';
  content: string;
  /** Raw base64 (no data: prefix). User turns only. */
  imageBase64?: string;
  imageMimeType?: string;
};

function stripDataUrlBase64(raw: string): string {
  return raw.replace(/^data:[^;]+;base64,/i, '').trim();
}

function partsForChatMessage(m: ChatApiMessage): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (m.role === 'model') {
    parts.push({ text: m.content || '' });
    return parts;
  }
  const text = (m.content || '').trim();
  if (text) parts.push({ text });
  if (m.imageBase64 && m.imageMimeType) {
    const data = stripDataUrlBase64(m.imageBase64);
    if (data.length > 0) {
      parts.push({
        inlineData: {
          mimeType: m.imageMimeType,
          data,
        },
      });
    }
  }
  if (parts.length === 0) {
    parts.push({ text: 'Vehicle image attached — describe what you see and help with diagnosis.' });
  }
  return parts;
}

export async function chatReply(messages: ChatApiMessage[]): Promise<string> {
  try {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: CHEAP_MODEL,
      systemInstruction: CHAT_SYSTEM,
    });
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role,
      parts: partsForChatMessage(m),
    }));
    while (history.length && history[0].role !== 'user') history.shift();
    const last = messages[messages.length - 1];
    if (last.role !== 'user') throw new Error('last message must be from user');
    const chat = model.startChat({ history });
    const r = await chat.sendMessage(partsForChatMessage(last));
    return r.response.text();
  } catch (err) {
    if (isQuotaExceededError(err)) {
      return AI_BUSY_MESSAGE;
    }
    throw err;
  }
}
