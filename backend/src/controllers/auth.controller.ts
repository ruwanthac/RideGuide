import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registerUser, loginUser, sanitizeForClient, changePassword } from '../services/auth.service';
import { UserModel } from '../models/User';
import { registerPendingProvider } from '../services/provider-registration.service';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(120),
  role: z.enum(['owner']).optional(),
  phoneNumber: z.string().max(40).optional(),
});

const providerRegisterSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
  role: z.enum(['mechanic', 'tow']),
  phoneNumber: z.string().max(40).optional(),
  businessName: z.string().min(1).max(200),
  businessAddress: z.string().max(500).optional(),
  truckName: z.string().max(120).optional(),
  plateNumber: z.string().max(40).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  password: z.string().min(8).max(200),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body);
    const result = await registerUser({ ...body, role: body.role ?? 'owner' });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function registerProvider(req: Request, res: Response, next: NextFunction) {
  try {
    const body = providerRegisterSchema.parse(req.body);
    const fileMap = req.files as Record<string, Express.Multer.File[]> | undefined;
    const files = fileMap ? Object.values(fileMap).flat() : [];
    const doc = await registerPendingProvider({
      email: body.email,
      displayName: body.displayName,
      phoneNumber: body.phoneNumber,
      role: body.role,
      businessName: body.businessName,
      businessAddress: body.businessAddress,
      truckName: body.truckName,
      plateNumber: body.plateNumber,
      files,
    });
    res.status(201).json({
      user: sanitizeForClient(doc),
      pendingVerification: true,
    });
  } catch (e) {
    next(e);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginSchema.parse(req.body);
    const result = await loginUser(body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await UserModel.findById(req.user!.userId);
    if (!user) return res.status(404).json({ error: 'not found' });
    res.json(sanitizeForClient(user));
  } catch (e) {
    next(e);
  }
}

export async function updatePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const body = changePasswordSchema.parse(req.body);
    await changePassword(req.user!.userId, body.password);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
