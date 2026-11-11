import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/ai-call-transcript.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'owner') {
      return res.status(403).json({ error: 'Only vehicle owners have AI call history.' });
    }
    const vehicleId = typeof req.query.vehicleId === 'string' ? req.query.vehicleId : undefined;
    res.json(await svc.listForOwner(req.user!.userId, vehicleId));
  } catch (e) {
    next(e);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'owner') {
      return res.status(403).json({ error: 'Only vehicle owners have AI call history.' });
    }
    const doc = await svc.getByIdForOwner(req.user!.userId, req.params.id);
    if (!doc) return res.status(404).json({ error: 'We couldn\'t find what you were looking for.' });
    res.json(doc);
  } catch (e) {
    next(e);
  }
}
