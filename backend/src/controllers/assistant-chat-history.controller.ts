import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/assistant-chat-session.service';

export async function listSessions(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'owner') {
      return res.status(403).json({ error: 'only owners can list assistant chat history' });
    }
    const vehicleId = typeof req.query.vehicleId === 'string' ? req.query.vehicleId : undefined;
    res.json(await svc.listSessions(req.user!.userId, vehicleId));
  } catch (e) {
    next(e);
  }
}

export async function getSession(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'owner') {
      return res.status(403).json({ error: 'only owners can view assistant chat history' });
    }
    const doc = await svc.getSessionForOwner(req.user!.userId, req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) {
    next(e);
  }
}
