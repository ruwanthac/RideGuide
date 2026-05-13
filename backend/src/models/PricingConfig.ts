import { Schema, model, InferSchemaType, Types } from 'mongoose';

const PricingConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    towPerKmLkr: { type: Number, required: true, default: 320, min: 0 },
    /** Max distance (km) from provider live location to job pickup for listing open roadside / tow hire jobs. */
    providerMatchRadiusKm: { type: Number, min: 1, max: 500 },
    /** Delete unclaimed open roadside/tow requests after this many minutes (owner pool only). */
    openRequestExpiryMinutes: { type: Number, min: 1, max: 10080 },
  },
  { timestamps: true }
);

export type PricingConfigDoc = InferSchemaType<typeof PricingConfigSchema> & { _id: Types.ObjectId };
export const PricingConfigModel = model('PricingConfig', PricingConfigSchema);

