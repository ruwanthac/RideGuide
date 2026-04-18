import { Types } from 'mongoose';
import { ChatMessageModel } from '../models/ChatMessage';
import { ServiceRequestModel } from '../models/ServiceRequest';
import { HttpError } from './auth.service';

export async function assertMember(requestId: string, userId: string, role: string) {
  const req = await ServiceRequestModel.findById(requestId).lean();
  if (!req) throw new HttpError(404, 'request not found');
  const isRequester = String(req.requesterId) === userId;
  const isProvider = req.acceptedBy && String(req.acceptedBy) === userId;
  if (!(isRequester || isProvider || role === 'admin')) throw new HttpError(403, 'not a member');
  return req;
}

export async function listMessages(requestId: string, userId: string, role: string) {
  await assertMember(requestId, userId, role);
  return ChatMessageModel.find({ requestId }).sort({ createdAt: 1 }).limit(500).lean();
}

export async function addMessage(requestId: string, userId: string, role: any, text: string) {
  await assertMember(requestId, userId, role);
  return ChatMessageModel.create({
    requestId: new Types.ObjectId(requestId),
    senderId: new Types.ObjectId(userId),
    senderRole: role,
    text,
  });
}
