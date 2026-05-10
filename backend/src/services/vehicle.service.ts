import { Types } from 'mongoose';
import { VehicleModel } from '../models/Vehicle';
import { UserModel } from '../models/User';
import { HttpError } from './auth.service';
import {
  buildCanonicalVehicleKey,
  getOrEnrichVehicleKnowledge,
} from './vehicle-cache.service';

export const MAX_VEHICLES_PER_OWNER = 3;

function ownsOrThrow(vehicle: any, userId: string) {
  if (!vehicle) throw new HttpError(404, 'vehicle not found');
  if (String(vehicle.ownerId) !== userId) throw new HttpError(403, 'forbidden');
}

export async function listVehicles(userId: string) {
  return VehicleModel.find({ ownerId: userId }).sort({ createdAt: 1 }).lean();
}

export async function createVehicle(
  userId: string,
  input: {
    label: string;
    makeModel: string;
    vin: string;
    year: number;
    plate: string;
    make?: string;
    model?: string;
    trim?: string;
    engine?: string;
  }
) {
  const existing = await VehicleModel.countDocuments({ ownerId: new Types.ObjectId(userId) });
  if (existing >= MAX_VEHICLES_PER_OWNER) {
    throw new HttpError(400, `You can register at most ${MAX_VEHICLES_PER_OWNER} vehicles on this account.`);
  }
  const owner = await UserModel.findById(userId).select('displayName').lean();
  const ownerName = (owner?.displayName ?? '').trim();
  const canonicalVehicleKey = buildCanonicalVehicleKey(input);
  const created = await VehicleModel.create({
    ownerId: new Types.ObjectId(userId),
    ownerName,
    ...input,
    canonicalVehicleKey,
  });
  if (process.env.NODE_ENV !== 'test') {
    void getOrEnrichVehicleKnowledge(input).catch((error) => {
      console.warn('[vehicle-service] enrichment failed after create:', error);
    });
  }
  return created;
}

export async function updateVehicle(
  userId: string,
  id: string,
  patch: Partial<{
    label: string;
    makeModel: string;
    vin: string;
    make: string;
    model: string;
    year: number;
    trim: string;
    engine: string;
    plate: string;
  }>
) {
  const v = await VehicleModel.findById(id);
  ownsOrThrow(v, userId);
  Object.assign(v!, patch);
  const nextCanonicalVehicleKey = buildCanonicalVehicleKey({
    make: v!.make,
    model: v!.model,
    year: v!.year,
    trim: v!.trim,
    engine: v!.engine,
    makeModel: v!.makeModel,
  });
  v!.canonicalVehicleKey = nextCanonicalVehicleKey;
  await v!.save();
  if (process.env.NODE_ENV !== 'test') {
    void getOrEnrichVehicleKnowledge({
      make: v!.make,
      model: v!.model,
      year: v!.year,
      trim: v!.trim,
      engine: v!.engine,
      makeModel: v!.makeModel,
    }).catch((error) => {
      console.warn('[vehicle-service] enrichment failed after update:', error);
    });
  }
  return v!.toObject();
}

export async function deleteVehicle(userId: string, id: string) {
  const v = await VehicleModel.findById(id);
  ownsOrThrow(v, userId);
  await v!.deleteOne();
}
