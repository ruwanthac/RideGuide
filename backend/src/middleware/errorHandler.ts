import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodIssue } from 'zod';
import multer from 'multer';
import { HttpError } from '../services/auth.service';
import {
  AI_BUSY_MESSAGE,
  AI_UNREACHABLE_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  isAiProviderError,
  isAiQuotaError,
} from '../utils/userFacingError';

/** Field names as a person would say them; unknown fields fall back to a spaced-out version of the key */
const FIELD_LABELS: Record<string, string> = {
  email: 'email address',
  password: 'password',
  displayName: 'name',
  phoneNumber: 'phone number',
  businessName: 'business name',
  businessAddress: 'business address',
  truckName: 'truck name',
  plateNumber: 'plate number',
  make: 'vehicle make',
  model: 'vehicle model',
  year: 'year',
  vin: 'VIN',
  mileage: 'mileage',
  symptoms: 'description of the problem',
  description: 'description',
  pickupAddress: 'pickup address',
  dropoffAddress: 'drop-off address',
  scheduledAt: 'date and time',
  text: 'message',
  content: 'message',
};

function fieldLabel(path: (string | number)[]): string {
  const key = [...path].reverse().find((p): p is string => typeof p === 'string');
  if (!key) return 'details';
  return FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function friendlyIssue(issue: ZodIssue): string {
  const label = fieldLabel(issue.path);
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' ? `Please enter your ${label}.` : `Please check your ${label}.`;
    case 'invalid_string':
      if (issue.validation === 'email') return 'Please enter a valid email address.';
      return `Please check your ${label}.`;
    case 'too_small':
      if (issue.type === 'string') {
        return Number(issue.minimum) <= 1
          ? `Please enter your ${label}.`
          : `Your ${label} must be at least ${issue.minimum} characters.`;
      }
      return `Please check your ${label}.`;
    case 'too_big':
      if (issue.type === 'string') return `Your ${label} is too long (max ${issue.maximum} characters).`;
      return `Please check your ${label}.`;
    case 'invalid_enum_value':
      return `Please choose a valid ${label}.`;
    default:
      return `Please check your ${label}.`;
  }
}

function formatZodError(err: ZodError): string {
  const messages = Array.from(new Set(err.issues.map(friendlyIssue)));
  return messages.length ? messages.join(' ') : 'Some details are missing or invalid. Please check and try again.';
}

function friendlyMulterError(err: multer.MulterError): string {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return 'That file is too large. Please choose a smaller one.';
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return 'Too many files, or a file was added in the wrong place. Please check your uploads.';
    default:
      return "We couldn't upload that file. Please try again.";
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: friendlyMulterError(err) });
  }
  if (err instanceof ZodError) {
    const details = err.flatten();
    return res.status(400).json({ error: formatZodError(err), details });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Anything else is unexpected: log the real cause, give the user a plain message.
  console.error('[ride-guide] unhandled error:', err);
  if (isAiQuotaError(err)) {
    return res.status(503).json({ error: AI_BUSY_MESSAGE });
  }
  if (isAiProviderError(err)) {
    return res.status(503).json({ error: AI_UNREACHABLE_MESSAGE });
  }
  res.status(500).json({ error: GENERIC_ERROR_MESSAGE });
}
