import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../models/User';
import { HttpError } from '../services/auth.service';

export function roleGuard(allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Please log in to continue.'));
    if (!allowed.includes(req.user.role)) return next(new HttpError(403, 'You don\'t have permission to do that.'));
    next();
  };
}
