import { Schema, model, InferSchemaType, Types } from 'mongoose';

const ServiceRequestSchema = new Schema(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['roadside', 'tow'], required: true },
    status: {
      type: String,
      enum: [
        'pending',
        'accepted',
        'attending_to_location',
        'requested',
        'driver_picked_hire',
        'driver_on_the_way',
        'driver_arrived',
        'vehicle_in_tow',
        'completed',
        'cancelled',
      ],
      default: 'pending',
    },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    /** Snapshot when a provider accepts (e.g. mechanic phone for owner UI). */
    acceptedProviderDisplayName: { type: String, default: '' },
    acceptedProviderPhone: { type: String, default: '' },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null, index: true },
    userName: { type: String, required: true },
    vehicle: { type: String, required: true },
    issue: { type: String, required: true },
    pickupAddress: { type: String, default: '' },
    pickupLatitude: { type: Number, default: null },
    pickupLongitude: { type: Number, default: null },
    dropoffAddress: { type: String, default: '' },
    dropoffLatitude: { type: Number, default: null },
    dropoffLongitude: { type: Number, default: null },
    bookingType: { type: String, enum: ['on_demand', 'scheduled'], default: 'on_demand' },
    scheduledAt: { type: Date, default: null },
    estimatedAmount: { type: Number, default: null },
    finalAmount: { type: Number, default: null },
    currency: { type: String, default: 'LKR' },
    pricingVersion: { type: String, default: 'v1' },
    paymentMethod: { type: String, enum: ['cash_manual'], default: 'cash_manual' },
    paymentState: { type: String, enum: ['unpaid', 'paid_offline'], default: 'unpaid' },
    location: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    phoneNumber: { type: String, required: true },
    /** Optional client idempotency key: duplicate POST with same key returns the same request. */
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true }
);

ServiceRequestSchema.index({ status: 1, createdAt: -1 });
ServiceRequestSchema.index(
  { requesterId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $exists: true, $type: 'string', $ne: '' } },
  }
);
ServiceRequestSchema.index({ requesterId: 1, vehicleId: 1, createdAt: -1 });
export type ServiceRequestDoc = InferSchemaType<typeof ServiceRequestSchema> & { _id: Types.ObjectId };
export const ServiceRequestModel = model('ServiceRequest', ServiceRequestSchema);
