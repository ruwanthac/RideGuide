import { Schema, model, InferSchemaType, Types } from 'mongoose';

const VehicleSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Denormalized from owner displayName for admin search and tables. */
    ownerName: { type: String, default: '', trim: true, index: true },
    label: { type: String, required: true },
    makeModel: { type: String, required: true },
    make: { type: String, default: null },
    model: { type: String, default: null },
    year: { type: Number, default: null },
    trim: { type: String, default: null },
    engine: { type: String, default: null },
    canonicalVehicleKey: { type: String, default: null, index: true },
    vin: { type: String, required: true },
  },
  { timestamps: true }
);

export type VehicleDoc = InferSchemaType<typeof VehicleSchema> & { _id: Types.ObjectId };
export const VehicleModel = model('Vehicle', VehicleSchema);
