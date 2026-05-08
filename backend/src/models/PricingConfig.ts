import { Schema, model, InferSchemaType, Types } from 'mongoose';

const PricingConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    towPerKmLkr: { type: Number, required: true, default: 320, min: 0 },
  },
  { timestamps: true }
);

export type PricingConfigDoc = InferSchemaType<typeof PricingConfigSchema> & { _id: Types.ObjectId };
export const PricingConfigModel = model('PricingConfig', PricingConfigSchema);

