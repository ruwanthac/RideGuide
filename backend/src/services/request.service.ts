import { Types } from 'mongoose';
import { ServiceRequestModel } from '../models/ServiceRequest';
import { UserModel } from '../models/User';
import { HttpError } from './auth.service';

type Role = 'owner' | 'mechanic' | 'tow' | 'admin';

export async function listForRole(userId: string, role: Role, vehicleId?: string) {
  if (role === 'admin') return ServiceRequestModel.find().sort({ createdAt: -1 }).limit(200).lean();
  if (role === 'owner') {
    const filter: Record<string, unknown> = { requesterId: userId };
    if (vehicleId) filter.vehicleId = vehicleId;
    return ServiceRequestModel.find(filter).sort({ createdAt: -1 }).lean();
  }
  const type = role === 'mechanic' ? 'roadside' : 'tow';
  return ServiceRequestModel.find({
    type,
    $or: [{ status: 'pending' }, { acceptedBy: new Types.ObjectId(userId) }],
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
}) {
  const user = await UserModel.findById(userId).lean();
  if (!user) throw new HttpError(401, 'no user');
  // ownership check if vehicleId provided
  if (input.vehicleId) {
    const { VehicleModel } = await import('../models/Vehicle');
    const v = await VehicleModel.findById(input.vehicleId).lean();
    if (!v || String(v.ownerId) !== userId) throw new HttpError(404, 'vehicle not found');
  }
  return ServiceRequestModel.create({
    requesterId: new Types.ObjectId(userId),
    userName: user.displayName,
    ...input,
    vehicleId: input.vehicleId ? new Types.ObjectId(input.vehicleId) : null,
  });
}

export async function transition(userId: string, role: Role, id: string, target: 'accepted' | 'completed' | 'cancelled') {
  const req = await ServiceRequestModel.findById(id);
  if (!req) throw new HttpError(404, 'not found');

  if (target === 'cancelled') {
    if (String(req.requesterId) !== userId && role !== 'admin') throw new HttpError(403, 'forbidden');
    req.status = 'cancelled';
  } else if (target === 'accepted') {
    if (!(role === 'mechanic' || role === 'tow')) throw new HttpError(403, 'only providers can accept');
    if (req.status !== 'pending') throw new HttpError(409, 'not pending');
    req.status = 'accepted';
    req.acceptedBy = new Types.ObjectId(userId);
  } else if (target === 'completed') {
    if (String(req.acceptedBy) !== userId && role !== 'admin') throw new HttpError(403, 'forbidden');
    if (req.status !== 'accepted') throw new HttpError(409, 'not accepted');
    req.status = 'completed';
  }
  await req.save();
  return req.toObject();
}

export async function removeRequest(userId: string, role: Role, id: string) {
  const req = await ServiceRequestModel.findById(id);
  if (!req) throw new HttpError(404, 'not found');
  if (String(req.requesterId) !== userId && role !== 'admin') throw new HttpError(403, 'forbidden');
  await req.deleteOne();
}
