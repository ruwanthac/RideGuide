import { Schema, model, InferSchemaType, Types } from 'mongoose';

const AdminAuditLogSchema = new Schema(
  {
    action: { type: String, required: true, index: true },
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AdminAuditLogSchema.index({ createdAt: -1 });

export type AdminAuditLogDoc = InferSchemaType<typeof AdminAuditLogSchema> & { _id: Types.ObjectId };
export const AdminAuditLogModel = model('AdminAuditLog', AdminAuditLogSchema);
