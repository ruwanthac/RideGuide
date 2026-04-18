import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { USER_ROLES } from '../models/User';
import * as svc from '../services/user.service';

const schema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  role: z.enum(USER_ROLES).optional(),
  selectedVehicleId: z.string().nullable().optional(),
  businessName: z.string().nullable().optional(),
  businessAddress: z.string().nullable().optional(),
  truckName: z.string().nullable().optional(),
  plateNumber: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  location: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
});

export async function patchMe(req: Request, res: Response, next: NextFunction) {
  try {
    const body = schema.parse(req.body);
    res.json(await svc.updateProfile(req.user!.userId, body as any));
  } catch (e) { next(e); }
}
