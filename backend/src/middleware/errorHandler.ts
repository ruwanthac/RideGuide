import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../services/auth.service';

function formatZodError(err: ZodError): string {
  const flat = err.flatten();
  const parts: string[] = [...(flat.formErrors ?? [])];
  for (const [field, msgs] of Object.entries(flat.fieldErrors)) {
    if (Array.isArray(msgs) && msgs.length) {
      parts.push(`${field}: ${msgs.join(', ')}`);
    }
  }
  return parts.length ? parts.join(' · ') : 'Invalid request';
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const details = err.flatten();
    return res.status(400).json({ error: formatZodError(err), details });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error('[ride-guide] unhandled error:', err);
  res.status(500).json({ error: message });
}
