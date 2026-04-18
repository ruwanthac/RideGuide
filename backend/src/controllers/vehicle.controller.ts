import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as svc from '../services/vehicle.service';

const createSchema = z.object({
  label: z.string().min(1).max(120),
  makeModel: z.string().min(1).max(200),
  vin: z.string().min(1).max(50),
});
const updateSchema = createSchema.partial();

export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.listVehicles(req.user!.userId)); } catch (e) { next(e); }
}
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body);
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
