import { InferSchemaType, Schema, model } from 'mongoose';

const VehicleKnowledgeCacheSchema = new Schema(
  {
    canonicalVehicleKey: { type: String, required: true, unique: true, index: true },
    enrichedData: {
      fuseBoxLocation: { type: String, default: '' },
      batteryLocation: { type: String, default: '' },
      obdPortLocation: { type: String, default: '' },
      jackPoints: { type: String, default: '' },
      commonIssues: { type: [String], default: [] },
      maintenanceSpecs: { type: Schema.Types.Mixed, default: {} },
      safetyWarnings: { type: [String], default: [] },
      notes: { type: String, default: '' },
    },
    source: { type: String, enum: ['ai_generated', 'manual'], default: 'ai_generated' },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type VehicleKnowledgeCacheDoc = InferSchemaType<typeof VehicleKnowledgeCacheSchema>;
export const VehicleKnowledgeCacheModel = model(
  'VehicleKnowledgeCache',
  VehicleKnowledgeCacheSchema
);

