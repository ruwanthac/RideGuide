import { Schema, model, InferSchemaType, Types } from 'mongoose';

const AssistantMsgSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    content: { type: String, required: true, maxlength: 8000 },
  },
  { _id: false }
);

const AssistantChatSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null, index: true },
    previewTitle: { type: String, default: '' },
    messages: { type: [AssistantMsgSchema], default: [] },
  },
  { timestamps: true }
);

AssistantChatSessionSchema.index({ userId: 1, updatedAt: -1 });

export type AssistantChatSessionDoc = InferSchemaType<typeof AssistantChatSessionSchema> & {
  _id: Types.ObjectId;
};
export const AssistantChatSessionModel = model('AssistantChatSession', AssistantChatSessionSchema);
