import { UserModel, USER_ROLES } from '../models/User';
import { HttpError } from './auth.service';

export interface ProfilePatch {
  displayName?: string;
  role?: typeof USER_ROLES[number];
  selectedVehicleId?: string | null;
  businessName?: string | null;
  businessAddress?: string | null;
  truckName?: string | null;
  plateNumber?: string | null;
  phoneNumber?: string | null;
  mechanicAvailable?: boolean;
  location?: { lat: number; lng: number } | null;
}

export async function updateProfile(userId: string, patch: ProfilePatch) {
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === 'location') {
      update.location = v === null ? null : { type: 'Point', coordinates: [(v as any).lng, (v as any).lat] };
    } else update[k] = v;
  }
  const u = await UserModel.findByIdAndUpdate(userId, { $set: update }, { new: true }).lean();
  if (!u) throw new HttpError(404, 'user not found');
  const { passwordHash, __v, ...rest } = u as any;
  return rest;
}
