import { Schema, model, InferSchemaType, Types } from 'mongoose';

export const USER_ROLES = ['owner', 'mechanic', 'tow', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, enum: USER_ROLES, default: 'owner', required: true },
    selectedVehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    businessName: { type: String, default: null },
    businessAddress: { type: String, default: null },
    truckName: { type: String, default: null },
    plateNumber: { type: String, default: null },
    phoneNumber: { type: String, default: null },
    /** When false, mechanic list omits open pending roadside pool and cannot accept new jobs. */
    mechanicAvailable: { type: Boolean, default: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: { type: [Number], default: undefined },
    },
  },
  { timestamps: true }
);

UserSchema.index({ location: '2dsphere' });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };
export const UserModel = model('User', UserSchema);
