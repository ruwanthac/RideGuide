import { Schema, model, InferSchemaType, Types } from 'mongoose';

const VehicleSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true },
    makeModel: { type: String, required: true },
    vin: { type: String, required: true },
  },
  { timestamps: true }
);

export type VehicleDoc = InferSchemaType<typeof VehicleSchema> & { _id: Types.ObjectId };
export const VehicleModel = model('Vehicle', VehicleSchema);
