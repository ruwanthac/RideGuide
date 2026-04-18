import { NextFunction, Request, Response } from 'express';
import { HttpError, verifyToken, TokenPayload } from '../services/auth.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authRequired(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(new HttpError(401, 'missing bearer token'));
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, 'invalid or expired token'));
  }
}
