import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registerUser, loginUser } from '../services/auth.service';
import { UserModel, USER_ROLES } from '../models/User';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(120),
  role: z.enum(USER_ROLES).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body);
    const result = await registerUser(body);
    res.status(201).json(result);
  } catch (e) { next(e); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginSchema.parse(req.body);
    const result = await loginUser(body);
    res.json(result);
  } catch (e) { next(e); }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await UserModel.findById(req.user!.userId).lean();
    if (!user) return res.status(404).json({ error: 'not found' });
    const { passwordHash, __v, ...rest } = user as any;
    res.json(rest);
  } catch (e) { next(e); }
}
