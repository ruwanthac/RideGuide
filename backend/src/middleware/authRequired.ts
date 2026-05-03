import { NextFunction, Request, Response } from 'express';
import { HttpError, verifyToken, TokenPayload } from '../services/auth.service';
import { UserModel } from '../models/User';

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
  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(new HttpError(401, 'invalid or expired token'));
  }
  void (async () => {
    try {
      const user = await UserModel.findById(payload.userId).select('_id role').lean();
      if (!user) return next(new HttpError(401, 'user not found'));
      req.user = { ...payload, role: user.role };
      next();
    } catch (e) {
      next(e);
    }
  })();
}
