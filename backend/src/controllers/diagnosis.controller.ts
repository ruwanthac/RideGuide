import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as svc from '../services/diagnosis.service';

const runSchema = z.object({
  symptoms: z.string().default(''),
  obdCode: z.string().default(''),
  vehicleId: z.string().min(1),
});

export async function run(req: Request, res: Response, next: NextFunction) {
  try {
    const body = runSchema.parse(req.body);
    const r = await svc.runDiagnosis(req.user!.userId, body);
    res.status(201).json(r);
  } catch (e) { next(e); }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const vehicleId = typeof req.query.vehicleId === 'string' ? req.query.vehicleId : undefined;
    res.json(await svc.listHistory(req.user!.userId, vehicleId));
  } catch (e) { next(e); }
}
