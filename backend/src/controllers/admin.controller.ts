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

const patchTowPricingSchema = z
  .object({
    towPerKmLkr: z.number().nonnegative().optional(),
    providerMatchRadiusKm: z.number().min(1).max(500).optional(),
    openRequestExpiryMinutes: z.number().min(1).max(10080).optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.towPerKmLkr !== undefined ||
      b.providerMatchRadiusKm !== undefined ||
      b.openRequestExpiryMinutes !== undefined,
    {
      message: 'Provide at least one of towPerKmLkr, providerMatchRadiusKm, openRequestExpiryMinutes',
    },
  );

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(120),
  phoneNumber: z.string().max(40).optional().nullable(),
});

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

export async function getAdminUser(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getUserByIdForAdmin(req.params.id));
  } catch (e) {
    next(e);
  }
}

export async function verifyProvider(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.verifyProviderApplication(req.params.id, req.user!.userId));
  } catch (e) {
    next(e);
  }
}

export async function rejectProvider(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.rejectProviderApplication(req.params.id, req.user!.userId));
  } catch (e) {
    next(e);
  }
}

export async function verificationFile(req: Request, res: Response, next: NextFunction) {
  try {
    const abs = await svc.getVerificationFileAbsolutePath(req.params.id, req.params.field);
    res.sendFile(abs, (err) => {
      if (err) next(err);
    });
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

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteUser(req.params.id, req.user!.userId);
    res.status(204).send();
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

export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createAdminSchema.parse(req.body);
    res.status(201).json(await svc.createAdminUser(req.user!.userId, body));
  } catch (e) {
    next(e);
  }
}
