import { Schema, model, InferSchemaType, Types } from 'mongoose';

const DiagnosisHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Omitted when the user ran diagnosis with manual vehicle text (e.g. mechanic/tow with no garage profile). */
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: false },
    vehicleLabel: { type: String, required: true },
    symptoms: { type: String, default: '' },
    obdCode: { type: String, default: '' },
    diagnosis: { type: String, required: true },
    severity: { type: String, enum: ['minor', 'moderate', 'critical'], required: true },
    likelyCauses: { type: [String], default: [] },
    steps: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

DiagnosisHistorySchema.index({ userId: 1, createdAt: -1 });
export type DiagnosisHistoryDoc = InferSchemaType<typeof DiagnosisHistorySchema> & { _id: Types.ObjectId };
export const DiagnosisHistoryModel = model('DiagnosisHistory', DiagnosisHistorySchema);
