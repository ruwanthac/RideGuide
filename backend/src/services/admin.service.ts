import { UserModel } from '../models/User';
import { VehicleModel } from '../models/Vehicle';
import { ServiceRequestModel } from '../models/ServiceRequest';
import { PricingConfigModel } from '../models/PricingConfig';
import { HttpError } from './auth.service';

export async function getStats() {
  const [userCount, vehicleCount, requestCount, pendingCount] = await Promise.all([
    UserModel.countDocuments(),
    VehicleModel.countDocuments(),
    ServiceRequestModel.countDocuments(),
    ServiceRequestModel.countDocuments({ status: 'pending' }),
  ]);
  return { userCount, vehicleCount, requestCount, pendingCount };
}

export async function listUsers(role?: string) {
  const filter = role ? { role } : {};
  return UserModel.find(filter).select('-passwordHash').sort({ createdAt: -1 }).limit(200).lean();
}

export async function updateUser(id: string, patch: { role?: string }) {
  const u = await UserModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).select('-passwordHash').lean();
  if (!u) throw new HttpError(404, 'user not found');
  return u;
}

export async function deleteRequest(id: string) {
  const r = await ServiceRequestModel.findByIdAndDelete(id).lean();
  if (!r) throw new HttpError(404, 'request not found');
}

export async function getTowPricing() {
  const doc =
    (await PricingConfigModel.findOne({ key: 'tow' }).lean()) ??
    (await PricingConfigModel.create({ key: 'tow', towPerKmLkr: 320 }));
  return { towPerKmLkr: Number(doc.towPerKmLkr ?? 320) };
}

export async function updateTowPricing(patch: { towPerKmLkr?: number }) {
  const nextTowPerKm = patch.towPerKmLkr;
  const update: { towPerKmLkr?: number } = {};
  if (typeof nextTowPerKm === 'number') {
    if (!Number.isFinite(nextTowPerKm) || nextTowPerKm < 0) throw new HttpError(400, 'invalid towPerKmLkr');
    update.towPerKmLkr = Math.round(nextTowPerKm);
  }
  const doc = await PricingConfigModel.findOneAndUpdate(
    { key: 'tow' },
    { $set: update, $setOnInsert: { key: 'tow' } },
    { upsert: true, new: true }
  ).lean();
  return { towPerKmLkr: Number(doc?.towPerKmLkr ?? 320) };
}
