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

type RequestWithProviderLocation = Record<string, any> & {
  acceptedBy?: unknown;
  requesterId?: unknown;
  acceptedProviderLocation?: { latitude: number; longitude: number } | null;
  requesterLiveLocation?: { latitude: number; longitude: number } | null;
};

const TOW_TRANSITIONS: Record<string, TowStatus | null> = {
  requested: 'driver_picked_hire',
  driver_picked_hire: 'driver_on_the_way',
  driver_on_the_way: 'driver_arrived',
  driver_arrived: 'vehicle_in_tow',
  vehicle_in_tow: 'completed',
  completed: null,
  cancelled: null,
};

/** Map user id → latest coordinates (batch lookup; avoids ~2 queries per row in list endpoints). */
function coordinatesToGeoPoint(coords: unknown): { latitude: number; longitude: number } | null {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [longitude, latitude] = coords;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return { latitude, longitude };
}

async function enrichProviderLocations<T extends RequestWithProviderLocation>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return [];

  const idSet = new Set<string>();
  for (const row of rows) {
    if (row?.acceptedBy) idSet.add(String(row.acceptedBy));
    if (row?.requesterId) idSet.add(String(row.requesterId));
  }

  let locByUserId = new Map<string, { latitude: number; longitude: number } | null>();
  if (idSet.size > 0) {
    const ids = [...idSet].map((id) => new Types.ObjectId(id));
    const users = await UserModel.find({ _id: { $in: ids } }).select('location').lean();
    locByUserId = new Map();
    for (const u of users) {
      const coords = u?.location?.coordinates;
      locByUserId.set(String(u._id), coordinatesToGeoPoint(coords));
    }
  }

  return rows.map((req) => {
    let acceptedProviderLocation: { latitude: number; longitude: number } | null = null;
    let requesterLiveLocation: { latitude: number; longitude: number } | null = null;
    if (req?.acceptedBy) {
      acceptedProviderLocation = locByUserId.get(String(req.acceptedBy)) ?? null;
    }
    if (req?.requesterId) {
      requesterLiveLocation = locByUserId.get(String(req.requesterId)) ?? null;
    }
    return {
      ...req,
      acceptedProviderLocation,
      requesterLiveLocation,
    };
  });
}

async function enrichProviderLocation<T extends RequestWithProviderLocation>(req: T): Promise<T> {
  const [out] = await enrichProviderLocations([req]);
  return out;
}

export async function listForRole(userId: string, role: Role, vehicleId?: string, historyOnly = false) {
  if (role === 'admin') {
    const rows = await ServiceRequestModel.find().sort({ createdAt: -1 }).limit(200).lean();
    return enrichProviderLocations(rows as RequestWithProviderLocation[]);
  }
  if (role === 'owner') {
    const filter: Record<string, unknown> = { requesterId: userId };
    if (vehicleId) filter.vehicleId = vehicleId;
    const rows = await ServiceRequestModel.find(filter).sort({ createdAt: -1 }).lean();
    return enrichProviderLocations(rows as RequestWithProviderLocation[]);
  }
  if (historyOnly) {
    if (role === 'tow') {
      const rows = await ServiceRequestModel.find({
        type: 'tow',
        acceptedBy: new Types.ObjectId(userId),
        status: { $in: ['completed', 'cancelled'] },
      }).sort({ createdAt: -1 }).limit(100).lean();
      return enrichProviderLocations(rows as RequestWithProviderLocation[]);
    }
    if (role === 'mechanic') {
      const rows = await ServiceRequestModel.find({
        type: 'roadside',
        acceptedBy: new Types.ObjectId(userId),
        status: { $in: ['completed', 'cancelled'] },
      }).sort({ createdAt: -1 }).limit(100).lean();
      return enrichProviderLocations(rows as RequestWithProviderLocation[]);
    }
    return [];
  }
  const type = role === 'mechanic' ? 'roadside' : 'tow';
  if (role === 'tow') {
    const rows = await ServiceRequestModel.find({
      type: 'tow',
      $or: [
        { status: 'requested' },
        {
          acceptedBy: new Types.ObjectId(userId),
          status: { $nin: ['completed', 'cancelled'] },
        },
      ],
    }).sort({ createdAt: -1 }).lean();
    return enrichProviderLocations(rows as RequestWithProviderLocation[]);
  }
  const mechanicUser = await UserModel.findById(userId).select('mechanicAvailable').lean();
  const mechanicReceiving = mechanicUser?.mechanicAvailable !== false;
  if (!mechanicReceiving) {
    const rows = await ServiceRequestModel.find({
      type: 'roadside',
      acceptedBy: new Types.ObjectId(userId),
      status: { $nin: ['completed', 'cancelled'] },
    }).sort({ createdAt: -1 }).lean();
    return enrichProviderLocations(rows as RequestWithProviderLocation[]);
  }
  const rows = await ServiceRequestModel.find({
    type,
    $or: [
      { status: 'pending' },
      {
        acceptedBy: new Types.ObjectId(userId),
        status: { $nin: ['completed', 'cancelled'] },
      },
    ],
  }).sort({ createdAt: -1 }).lean();
  return enrichProviderLocations(rows as RequestWithProviderLocation[]);
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
  /** When set, duplicate POSTs with the same key return the existing row (per requester). */
  idempotencyKey?: string;
}) {
  const trimmedKey =
    typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim().slice(0, 64) : '';
  if (trimmedKey) {
    const dup = await ServiceRequestModel.findOne({
      requesterId: new Types.ObjectId(userId),
      idempotencyKey: trimmedKey,
    }).lean();
    if (dup) return enrichProviderLocation(dup as RequestWithProviderLocation);
  }

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
  const payload = {
    requesterId: new Types.ObjectId(userId),
    userName: user.displayName,
    type: input.type,
    vehicle: input.vehicle,
    issue: input.issue,
    location: input.location,
    latitude: input.latitude,
    longitude: input.longitude,
    phoneNumber: input.phoneNumber,
    status: isTow ? ('requested' as const) : ('pending' as const),
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
    paymentMethod: 'cash_manual' as const,
    paymentState: 'unpaid' as const,
    vehicleId: input.vehicleId ? new Types.ObjectId(input.vehicleId) : null,
    ...(trimmedKey ? { idempotencyKey: trimmedKey } : {}),
  };
  try {
    const row = await ServiceRequestModel.create(payload);
    return enrichProviderLocation(row.toObject() as RequestWithProviderLocation);
  } catch (e: any) {
    if (e?.code === 11000 && trimmedKey) {
      const dup = await ServiceRequestModel.findOne({
        requesterId: new Types.ObjectId(userId),
        idempotencyKey: trimmedKey,
      }).lean();
      if (dup) return enrichProviderLocation(dup as RequestWithProviderLocation);
    }
    throw e;
  }
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
  return enrichProviderLocation(req.toObject() as RequestWithProviderLocation);
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
