import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as svc from '../services/vehicle.service';

const createSchema = z.object({
  label: z.string().min(1).max(120),
  makeModel: z.string().min(1).max(200),
  vin: z.string().min(1).max(50),
  year: z.number().int().min(1900).max(2100),
  plate: z.string().min(1).max(24),
  make: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  trim: z.string().min(1).max(100).optional(),
  engine: z.string().min(1).max(120).optional(),
});

/** Trim string fields; drop empty strings so partial PATCH does not fail Zod min(1) on "". */
function trimVehicleBody(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const o = { ...(raw as Record<string, unknown>) };
  for (const key of Object.keys(o)) {
    const v = o[key];
    if (typeof v === 'string') {
      const t = v.trim();
      o[key] = t === '' ? undefined : t;
    }
  }
  return o;
}

const updateSchema = z.preprocess(trimVehicleBody, createSchema.partial());
const createSchemaTrimmed = z.preprocess(trimVehicleBody, createSchema);

export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.listVehicles(req.user!.userId)); } catch (e) { next(e); }
}
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchemaTrimmed.parse(req.body);
    const v = await svc.createVehicle(req.user!.userId, body);
    res.status(201).json(v);
  } catch (e) { next(e); }
}
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateSchema.parse(req.body);
    res.json(await svc.updateVehicle(req.user!.userId, req.params.id, body));
  } catch (e) { next(e); }
}
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteVehicle(req.user!.userId, req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}
