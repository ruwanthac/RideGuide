import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as svc from '../services/diagnosis.service';

/** Coerce null/undefined and trim; empty string becomes undefined (clients often send explicit null). */
const optTrimmed = z.preprocess((v: unknown) => {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim();
  return t === '' ? undefined : t;
}, z.string().optional());

const runSchema = z
  .object({
    symptoms: z.preprocess((v: unknown) => (v === null || v === undefined ? '' : String(v)), z.string()),
    obdCode: z.preprocess((v: unknown) => (v === null || v === undefined ? '' : String(v)), z.string()),
    vehicleId: optTrimmed,
    vehicleMakeModel: optTrimmed,
    vehicleVin: optTrimmed,
  })
  .superRefine((data, ctx) => {
    const hasVehicle = !!data.vehicleId?.length;
    const hasManual = !!data.vehicleMakeModel?.length;
    if (!hasVehicle && !hasManual) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose a saved vehicle or enter make & model.',
        path: ['vehicleMakeModel'],
      });
    }
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
