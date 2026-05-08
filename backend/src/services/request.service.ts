import { Types } from 'mongoose';
import { ServiceRequestModel } from '../models/ServiceRequest';
import { UserModel } from '../models/User';
import { PricingConfigModel } from '../models/PricingConfig';
import { HttpError } from './auth.service';

type Role = 'owner' | 'mechanic' | 'tow' | 'admin';
type LegacyStatus = 'pending' | 'accepted' | 'attending_to_location' | 'completed' | 'cancelled';
type TowStatus =
  | 'requested'
  | 'driver_picked_hire'
  | 'driver_on_the_way'
  | 'driver_arrived'
  | 'vehicle_in_tow'
  | 'completed'
  | 'cancelled';

const TOW_TRANSITIONS: Record<string, TowStatus | null> = {
  requested: 'driver_picked_hire',
  driver_picked_hire: 'driver_on_the_way',
  driver_on_the_way: 'driver_arrived',
  driver_arrived: 'vehicle_in_tow',
  vehicle_in_tow: 'completed',
  completed: null,
  cancelled: null,
};

export async function listForRole(userId: string, role: Role, vehicleId?: string, historyOnly = false) {
  if (role === 'admin') return ServiceRequestModel.find().sort({ createdAt: -1 }).limit(200).lean();
  if (role === 'owner') {
    const filter: Record<string, unknown> = { requesterId: userId };
    if (vehicleId) filter.vehicleId = vehicleId;
    return ServiceRequestModel.find(filter).sort({ createdAt: -1 }).lean();
  }
  if (historyOnly) {
    if (role === 'tow') {
      return ServiceRequestModel.find({
        type: 'tow',
        acceptedBy: new Types.ObjectId(userId),
        status: { $in: ['completed', 'cancelled'] },
      }).sort({ createdAt: -1 }).limit(100).lean();
    }
    if (role === 'mechanic') {
      return ServiceRequestModel.find({
        type: 'roadside',
        acceptedBy: new Types.ObjectId(userId),
        status: { $in: ['completed', 'cancelled'] },
      }).sort({ createdAt: -1 }).limit(100).lean();
    }
    return [];
  }
  const type = role === 'mechanic' ? 'roadside' : 'tow';
  if (role === 'tow') {
    return ServiceRequestModel.find({
      type: 'tow',
      $or: [
        { status: 'requested' },
        {
          acceptedBy: new Types.ObjectId(userId),
          status: { $nin: ['completed', 'cancelled'] },
        },
      ],
    }).sort({ createdAt: -1 }).lean();
  }
  const mechanicUser = await UserModel.findById(userId).select('mechanicAvailable').lean();
  const mechanicReceiving = mechanicUser?.mechanicAvailable !== false;
  if (!mechanicReceiving) {
    return ServiceRequestModel.find({
      type: 'roadside',
      acceptedBy: new Types.ObjectId(userId),
      status: { $nin: ['completed', 'cancelled'] },
    }).sort({ createdAt: -1 }).lean();
  }
  return ServiceRequestModel.find({
    type,
    $or: [
      { status: 'pending' },
      {
        acceptedBy: new Types.ObjectId(userId),
        status: { $nin: ['completed', 'cancelled'] },
      },
    ],
  }).sort({ createdAt: -1 }).lean();
}

export async function createRequest(userId: string, input: {
  type: 'roadside' | 'tow';
  vehicle: string;
  issue: string;
  location: string;
  latitude: number;
  longitude: number;
  phoneNumber: string;
  vehicleId?: string;
  pickupAddress?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffAddress?: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  bookingType?: 'on_demand' | 'scheduled';
  scheduledAt?: string;
  estimatedAmount?: number;
  finalAmount?: number;
  currency?: string;
  pricingVersion?: string;
}) {
  const user = await UserModel.findById(userId).lean();
  if (!user) throw new HttpError(401, 'no user');
  // ownership check if vehicleId provided
  if (input.vehicleId) {
    const { VehicleModel } = await import('../models/Vehicle');
    const v = await VehicleModel.findById(input.vehicleId).lean();
    if (!v || String(v.ownerId) !== userId) throw new HttpError(404, 'vehicle not found');
  }
  const isTow = input.type === 'tow';
  if (isTow) {
    if (!input.dropoffAddress?.trim()) throw new HttpError(400, 'dropoffAddress is required for tow');
    if (input.bookingType === 'scheduled') {
      if (!input.scheduledAt) throw new HttpError(400, 'scheduledAt is required for scheduled booking');
      const schedule = new Date(input.scheduledAt);
      if (Number.isNaN(schedule.getTime()) || schedule.getTime() <= Date.now()) {
        throw new HttpError(400, 'scheduledAt must be a future date');
      }
    }
  }
  return ServiceRequestModel.create({
    requesterId: new Types.ObjectId(userId),
    userName: user.displayName,
    ...input,
    status: isTow ? 'requested' : 'pending',
    pickupAddress: input.pickupAddress ?? input.location,
    pickupLatitude: input.pickupLatitude ?? input.latitude,
    pickupLongitude: input.pickupLongitude ?? input.longitude,
    dropoffAddress: input.dropoffAddress ?? input.location,
    dropoffLatitude: input.dropoffLatitude ?? null,
    dropoffLongitude: input.dropoffLongitude ?? null,
    bookingType: input.bookingType ?? 'on_demand',
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    estimatedAmount: input.estimatedAmount ?? null,
    finalAmount: input.finalAmount ?? null,
    currency: input.currency ?? 'LKR',
    pricingVersion: input.pricingVersion ?? 'v1',
    paymentMethod: 'cash_manual',
    paymentState: 'unpaid',
    vehicleId: input.vehicleId ? new Types.ObjectId(input.vehicleId) : null,
  });
}

export async function transition(
  userId: string,
  role: Role,
  id: string,
  target: LegacyStatus | TowStatus,
) {
  const req = await ServiceRequestModel.findById(id);
  if (!req) throw new HttpError(404, 'not found');
  const isTow = req.type === 'tow';

  if (target === 'cancelled') {
    if (String(req.requesterId) !== userId && role !== 'admin') throw new HttpError(403, 'forbidden');
    if (isTow && req.status !== 'requested' && role !== 'admin') {
      throw new HttpError(409, 'can only cancel before driver accepts');
    }
    if (!isTow && req.status !== 'pending' && role !== 'admin') {
      throw new HttpError(409, 'can only cancel before mechanic accepts');
    }
    req.status = 'cancelled';
  } else if (!isTow && target === 'accepted') {
    if (role !== 'mechanic' && role !== 'admin') {
      throw new HttpError(403, 'only mechanics can accept roadside requests');
    }
    if (role === 'mechanic') {
      const providerRow = await UserModel.findById(userId).select('mechanicAvailable').lean();
      if (providerRow?.mechanicAvailable === false) {
        throw new HttpError(400, 'turn on availability to accept new requests');
      }
    }
    if (req.status !== 'pending') throw new HttpError(409, 'not pending');
    req.status = 'accepted';
    req.acceptedBy = new Types.ObjectId(userId);
    const provider = await UserModel.findById(userId).lean();
    if (provider) {
      (req as any).acceptedProviderDisplayName = provider.displayName ?? '';
      (req as any).acceptedProviderPhone = provider.phoneNumber ?? '';
    }
  } else if (!isTow && target === 'completed') {
    if (String(req.acceptedBy) !== userId && role !== 'admin') throw new HttpError(403, 'forbidden');
    if (req.status !== 'attending_to_location') throw new HttpError(409, 'must be attending to location first');
    req.status = 'completed';
  } else if (!isTow && target === 'attending_to_location') {
    if (String(req.acceptedBy) !== userId && role !== 'admin') throw new HttpError(403, 'forbidden');
    if (req.status !== 'accepted') throw new HttpError(409, 'not accepted');
    req.status = 'attending_to_location';
  } else if (isTow) {
    if (role !== 'tow' && role !== 'admin') throw new HttpError(403, 'only tow providers can update status');
    if (role === 'tow' && req.acceptedBy && String(req.acceptedBy) !== userId) {
      throw new HttpError(403, 'forbidden');
    }
    if (target === 'accepted') target = 'driver_picked_hire';
    const current = req.status as TowStatus;
    const next = TOW_TRANSITIONS[current];
    if (!next) throw new HttpError(409, 'request is not active');
    if (target !== next) throw new HttpError(409, `next status must be ${next}`);
    if (current === 'requested') {
      req.acceptedBy = new Types.ObjectId(userId);
    }
    req.status = target;
  } else {
    throw new HttpError(400, 'invalid status transition');
  }
  await req.save();
  return req.toObject();
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function estimateTowPrice(input: {
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  bookingType?: 'on_demand' | 'scheduled';
  towPerKmLkr?: number;
}) {
  const fallbackDistanceKm = 5;
  const distanceKm =
    typeof input.dropoffLatitude === 'number' && typeof input.dropoffLongitude === 'number'
      ? haversineKm(input.pickupLatitude, input.pickupLongitude, input.dropoffLatitude, input.dropoffLongitude)
      : fallbackDistanceKm;
  const roundedDistance = Math.max(1, Number(distanceKm.toFixed(1)));
  const perKm = input.towPerKmLkr ?? 320;
  const baseFee = 0;
  const scheduleSurcharge = 0;
  const estimatedAmount = Math.round(roundedDistance * perKm);
  return {
    distanceKm: roundedDistance,
    estimatedAmount,
    currency: 'LKR',
    pricingVersion: 'v1',
    breakdown: { baseFee, perKm, scheduleSurcharge },
  };
}

export async function estimateTowPriceWithConfig(input: {
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  bookingType?: 'on_demand' | 'scheduled';
}) {
  const pricing =
    (await PricingConfigModel.findOne({ key: 'tow' }).lean()) ??
    (await PricingConfigModel.create({ key: 'tow', towPerKmLkr: 320 }));
  const towPerKmLkr = Number(pricing.towPerKmLkr ?? 320);
  return estimateTowPrice({ ...input, towPerKmLkr });
}

export async function removeRequest(userId: string, role: Role, id: string) {
  const req = await ServiceRequestModel.findById(id);
  if (!req) throw new HttpError(404, 'not found');
  if (String(req.requesterId) !== userId && role !== 'admin') throw new HttpError(403, 'forbidden');
  await req.deleteOne();
}
