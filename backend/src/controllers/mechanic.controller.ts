import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as svc from '../services/mechanic.service';

const schema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusKm: z.coerce.number().min(0.1).max(200).default(15),
  role: z.enum(['mechanic', 'tow']).default('mechanic'),
});

export async function nearby(req: Request, res: Response, next: NextFunction) {
  try {
    const q = schema.parse(req.query);
    res.json(await svc.findNearby(q));
  } catch (e) { next(e); }
}
