import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../services/auth.service';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'validation failed', details: err.flatten() });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error('[ride-guide] unhandled error:', err);
  res.status(500).json({ error: message });
}
