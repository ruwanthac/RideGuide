import { Types } from 'mongoose';
import { AssistantChatSessionModel } from '../models/AssistantChatSession';

const MAX_MESSAGES = 80;

function previewFromMessages(messages: { role: string; content: string }[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  const raw = firstUser?.content?.trim() || 'AI assistant chat';
  return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw;
}

export async function saveAssistantTurn(params: {
  userId: string;
  sessionId?: string | null;
  vehicleId?: string | null;
  messages: { role: 'user' | 'model'; content: string }[];
  reply: string;
}): Promise<string> {
  const uid = new Types.ObjectId(params.userId);
  const vid =
    params.vehicleId && Types.ObjectId.isValid(params.vehicleId)
      ? new Types.ObjectId(params.vehicleId)
      : null;
  const full = [...params.messages, { role: 'model' as const, content: params.reply }].slice(
    -MAX_MESSAGES
  );

  if (params.sessionId && Types.ObjectId.isValid(params.sessionId)) {
    const sid = new Types.ObjectId(params.sessionId);
    const existing = await AssistantChatSessionModel.findOne({
      _id: sid,
      userId: uid,
    }).lean();
    if (existing) {
      await AssistantChatSessionModel.updateOne(
        { _id: sid, userId: uid },
        {
          $set: {
            messages: full,
            vehicleId: vid ?? existing.vehicleId ?? null,
            previewTitle: previewFromMessages(full),
          },
        }
      );
      return String(sid);
    }
  }

  const created = await AssistantChatSessionModel.create({
    userId: uid,
    vehicleId: vid,
    previewTitle: previewFromMessages(full),
    messages: full,
  });
  return String(created._id);
}

export async function listSessions(userId: string, vehicleId?: string) {
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (vehicleId && Types.ObjectId.isValid(vehicleId)) {
    filter.vehicleId = new Types.ObjectId(vehicleId);
  }
  return AssistantChatSessionModel.find(filter)
    .sort({ updatedAt: -1 })
    .limit(100)
    .select('previewTitle vehicleId createdAt updatedAt')
    .lean();
}

export async function getSessionForOwner(userId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  return AssistantChatSessionModel.findOne({
    _id: new Types.ObjectId(id),
    userId: new Types.ObjectId(userId),
  }).lean();
}
