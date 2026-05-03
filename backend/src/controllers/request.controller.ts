import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as svc from '../services/request.service';
import { emitRequestNew, emitRequestUpdated } from '../sockets/requests.socket';
import * as chatSvc from '../services/chat.service';

const createSchema = z.object({
  type: z.enum(['roadside', 'tow']),
  vehicle: z.string().min(1),
  issue: z.string().min(1),
  location: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  phoneNumber: z.string().min(1),
  vehicleId: z.string().optional(),
  pickupAddress: z.string().optional(),
  pickupLatitude: z.number().optional(),
  pickupLongitude: z.number().optional(),
  dropoffAddress: z.string().optional(),
  dropoffLatitude: z.number().optional(),
  dropoffLongitude: z.number().optional(),
  bookingType: z.enum(['on_demand', 'scheduled']).optional(),
  scheduledAt: z.string().optional(),
  estimatedAmount: z.number().nonnegative().optional(),
  finalAmount: z.number().nonnegative().optional(),
  currency: z.string().min(1).optional(),
  pricingVersion: z.string().min(1).optional(),
});
const patchSchema = z.object({
  status: z.enum([
    'accepted',
    'completed',
    'cancelled',
    'driver_picked_hire',
    'driver_on_the_way',
    'driver_arrived',
    'vehicle_in_tow',
  ]),
});
const towEstimateSchema = z.object({
  pickupLatitude: z.number(),
  pickupLongitude: z.number(),
  dropoffLatitude: z.number().optional(),
  dropoffLongitude: z.number().optional(),
  bookingType: z.enum(['on_demand', 'scheduled']).optional(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const vehicleId = typeof req.query.vehicleId === 'string' ? req.query.vehicleId : undefined;
    res.json(await svc.listForRole(req.user!.userId, req.user!.role, vehicleId));
  } catch (e) { next(e); }
}
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'owner') return res.status(403).json({ error: 'only owners can create' });
    const body = createSchema.parse(req.body);
    const r = await svc.createRequest(req.user!.userId, body);
    res.status(201).json(r);
    try { emitRequestNew(r.toObject ? r.toObject() : r); } catch { /* no-io during tests */ }
  } catch (e) { next(e); }
}
export async function towEstimate(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'owner') return res.status(403).json({ error: 'only owners can estimate' });
    const body = towEstimateSchema.parse(req.body);
    res.json(svc.estimateTowPrice(body));
  } catch (e) { next(e); }
}
export async function patch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = patchSchema.parse(req.body);
    const updated = await svc.transition(req.user!.userId, req.user!.role, req.params.id, body.status);
    res.json(updated);
    try { emitRequestUpdated(updated); } catch { /* no-io during tests */ }
  } catch (e) { next(e); }
}
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.removeRequest(req.user!.userId, req.user!.role, req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}

export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await chatSvc.listMessages(req.params.id, req.user!.userId, req.user!.role));
  } catch (e) { next(e); }
}
