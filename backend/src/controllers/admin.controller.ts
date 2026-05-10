import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { USER_ROLES } from '../models/User';
import * as svc from '../services/admin.service';

const patchUserSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    displayName: z.string().min(1).max(120).optional(),
    phoneNumber: z.string().max(40).nullable().optional(),
    mechanicAvailable: z.boolean().optional(),
    businessName: z.string().max(200).nullable().optional(),
    businessAddress: z.string().max(500).nullable().optional(),
    truckName: z.string().max(120).nullable().optional(),
    plateNumber: z.string().max(40).nullable().optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .strict();

const patchTowPricingSchema = z.object({ towPerKmLkr: z.number().nonnegative() });

export async function stats(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getStats());
  } catch (e) {
    next(e);
  }
}

export async function users(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.listUsersPaginated(req.query as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
}

export async function patchUser(req: Request, res: Response, next: NextFunction) {
  try {
    const body = patchUserSchema.parse(req.body);
    res.json(await svc.updateUser(req.params.id, body, req.user!.userId));
  } catch (e) {
    next(e);
  }
}

export async function removeRequestAsAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteRequest(req.params.id, req.user!.userId);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function getTowPricing(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getTowPricing());
  } catch (e) {
    next(e);
  }
}

export async function patchTowPricing(req: Request, res: Response, next: NextFunction) {
  try {
    const body = patchTowPricingSchema.parse(req.body);
    res.json(await svc.updateTowPricing(body, req.user!.userId));
  } catch (e) {
    next(e);
  }
}

export async function listRequests(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.listServiceRequests(req.query as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
}

export async function getRequest(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getServiceRequestById(req.params.id));
  } catch (e) {
    next(e);
  }
}

export async function listVehicles(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.listVehicles(req.query as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
}

export async function listDiagnoses(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.listDiagnoses(req.query as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
}

export async function analytics(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getAnalytics(req.query as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
}

export async function auditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.listAuditLogs(req.query as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
}

export async function seedDemo(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.seedDemo(req.user!.userId));
  } catch (e) {
    next(e);
  }
}
