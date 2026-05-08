import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { USER_ROLES } from '../models/User';
import * as svc from '../services/admin.service';

const patchUserSchema = z.object({ role: z.enum(USER_ROLES).optional() });
const patchTowPricingSchema = z.object({ towPerKmLkr: z.number().nonnegative() });

export async function stats(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getStats()); } catch (e) { next(e); }
}
export async function users(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.listUsers(typeof req.query.role === 'string' ? req.query.role : undefined)); }
  catch (e) { next(e); }
}
export async function patchUser(req: Request, res: Response, next: NextFunction) {
  try {
    const body = patchUserSchema.parse(req.body);
    res.json(await svc.updateUser(req.params.id, body));
  } catch (e) { next(e); }
}
export async function removeRequestAsAdmin(req: Request, res: Response, next: NextFunction) {
  try { await svc.deleteRequest(req.params.id); res.status(204).send(); } catch (e) { next(e); }
}

export async function getTowPricing(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getTowPricing()); } catch (e) { next(e); }
}

export async function patchTowPricing(req: Request, res: Response, next: NextFunction) {
  try {
    const body = patchTowPricingSchema.parse(req.body);
    res.json(await svc.updateTowPricing(body));
  } catch (e) { next(e); }
}
