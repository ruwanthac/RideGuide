import { Types } from 'mongoose';
import { AiCallTranscriptModel } from '../models/AiCallTranscript';
import { summarizeAiCallMessages } from './gemini.client';

export async function recordEndedAiCall(params: {
  userId: string;
  vehicleId: string | null;
  sessionId: string;
  messages: { role: 'user' | 'model'; content: string }[];
  startedAt: number;
}): Promise<void> {
  if (!params.messages.length) return;
  const uid = new Types.ObjectId(params.userId);
  const vid =
    params.vehicleId && Types.ObjectId.isValid(params.vehicleId)
      ? new Types.ObjectId(params.vehicleId)
      : null;
  const capped = params.messages.slice(-50);
  let summary = '';
  try {
    summary = await summarizeAiCallMessages(capped);
  } catch (e) {
    console.warn('[ai-call-transcript] summarize failed:', e);
  }
  const fallback = `Video AI call · ${new Date(params.startedAt).toLocaleString()}`;
  const finalSummary = summary.trim() || fallback;
  await AiCallTranscriptModel.create({
    userId: uid,
    vehicleId: vid,
    sessionId: params.sessionId,
    messages: capped,
    summary: finalSummary,
    endedAt: new Date(),
  });
}

export async function listForOwner(userId: string, vehicleId?: string) {
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (vehicleId && Types.ObjectId.isValid(vehicleId)) {
    filter.vehicleId = new Types.ObjectId(vehicleId);
  }
  return AiCallTranscriptModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .select('summary vehicleId sessionId createdAt endedAt')
    .lean();
}

export async function getByIdForOwner(userId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  return AiCallTranscriptModel.findOne({
    _id: new Types.ObjectId(id),
    userId: new Types.ObjectId(userId),
  }).lean();
}
