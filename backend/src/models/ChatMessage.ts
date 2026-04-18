import { Schema, model, InferSchemaType, Types } from 'mongoose';
import { USER_ROLES } from './User';

const ChatMessageSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: USER_ROLES, required: true },
    text: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ChatMessageSchema.index({ requestId: 1, createdAt: 1 });
export type ChatMessageDoc = InferSchemaType<typeof ChatMessageSchema> & { _id: Types.ObjectId };
export const ChatMessageModel = model('ChatMessage', ChatMessageSchema);
