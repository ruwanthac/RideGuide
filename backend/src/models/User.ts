import { Schema, model, InferSchemaType, Types } from 'mongoose';

export const USER_ROLES = ['owner', 'mechanic', 'tow', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export const PROVIDER_VERIFICATION_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;
export type ProviderVerificationStatus = (typeof PROVIDER_VERIFICATION_STATUSES)[number];

/** Relative paths under upload root, keyed by multipart field name. */
const ProviderVerificationSchema = new Schema(
  {
    mechanicBrCopy: { type: String, default: null },
    mechanicNicCopy: { type: String, default: null },
    towCompanyBrCopy: { type: String, default: null },
    towCompanyNicCopy: { type: String, default: null },
    towTruckRegCopy: { type: String, default: null },
    towTruckNicCopy: { type: String, default: null },
  },
  { _id: false }
);

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
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    providerVerificationStatus: {
      type: String,
      enum: PROVIDER_VERIFICATION_STATUSES,
      default: 'none',
      index: true,
    },
    providerVerificationSubmittedAt: { type: Date, default: null },
    providerVerificationReviewedAt: { type: Date, default: null },
    providerVerification: { type: ProviderVerificationSchema, default: () => ({}) },
    /**
     * When true, user must replace the one-time password after login.
     * Primarily used for provider OTP flow after admin approval.
     */
    mustChangePassword: { type: Boolean, default: false },
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
UserSchema.index({ role: 1, providerVerificationStatus: 1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };
export const UserModel = model('User', UserSchema);

/** Pre-feature mechanics/tow users have no status — treat as approved. */
export function effectiveProviderVerificationStatus(
  role: UserRole,
  status: ProviderVerificationStatus | null | undefined
): ProviderVerificationStatus {
  if (role !== 'mechanic' && role !== 'tow') return 'approved';
  if (status === undefined || status === null || status === 'none') return 'approved';
  return status;
}
