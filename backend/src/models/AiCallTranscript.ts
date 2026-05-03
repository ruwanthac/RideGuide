import { Schema, model, InferSchemaType, Types } from 'mongoose';

const MessageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    content: { type: String, required: true, maxlength: 8000 },
  },
  { _id: false }
);

const AiCallTranscriptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null, index: true },
    sessionId: { type: String, required: true, index: true },
    messages: { type: [MessageSchema], default: [] },
    summary: { type: String, default: '' },
    continuedFrom: { type: Schema.Types.ObjectId, ref: 'AiCallTranscript', default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AiCallTranscriptSchema.index({ userId: 1, createdAt: -1 });

export type AiCallTranscriptDoc = InferSchemaType<typeof AiCallTranscriptSchema> & { _id: Types.ObjectId };
export const AiCallTranscriptModel = model('AiCallTranscript', AiCallTranscriptSchema);
