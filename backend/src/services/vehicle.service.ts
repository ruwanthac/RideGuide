import { Types } from 'mongoose';
import { VehicleModel } from '../models/Vehicle';
import { HttpError } from './auth.service';

function ownsOrThrow(vehicle: any, userId: string) {
  if (!vehicle) throw new HttpError(404, 'vehicle not found');
  if (String(vehicle.ownerId) !== userId) throw new HttpError(403, 'forbidden');
}

export async function listVehicles(userId: string) {
  return VehicleModel.find({ ownerId: userId }).sort({ createdAt: 1 }).lean();
}

export async function createVehicle(userId: string, input: { label: string; makeModel: string; vin: string }) {
  return VehicleModel.create({ ownerId: new Types.ObjectId(userId), ...input });
}

export async function updateVehicle(userId: string, id: string, patch: Partial<{ label: string; makeModel: string; vin: string }>) {
  const v = await VehicleModel.findById(id);
  ownsOrThrow(v, userId);
  Object.assign(v!, patch);
  await v!.save();
  return v!.toObject();
}

export async function deleteVehicle(userId: string, id: string) {
  const v = await VehicleModel.findById(id);
  ownsOrThrow(v, userId);
  await v!.deleteOne();
}
