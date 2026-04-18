import { Schema, model, InferSchemaType, Types } from 'mongoose';

const ServiceRequestSchema = new Schema(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['roadside', 'tow'], required: true },
    status: { type: String, enum: ['pending', 'accepted', 'completed', 'cancelled'], default: 'pending' },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null, index: true },
    userName: { type: String, required: true },
    vehicle: { type: String, required: true },
    issue: { type: String, required: true },
    location: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    phoneNumber: { type: String, required: true },
  },
  { timestamps: true }
);

ServiceRequestSchema.index({ status: 1, createdAt: -1 });
ServiceRequestSchema.index({ requesterId: 1, vehicleId: 1, createdAt: -1 });
export type ServiceRequestDoc = InferSchemaType<typeof ServiceRequestSchema> & { _id: Types.ObjectId };
export const ServiceRequestModel = model('ServiceRequest', ServiceRequestSchema);
