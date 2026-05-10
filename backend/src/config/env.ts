import dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL_CHEAP: z.string().default('gemini-2.5-flash'),
  GEMINI_MODEL_LIVE: z.string().default('gemini-2.5-flash-native-audio-latest'),
  CORS_ORIGIN: z.string().default('*'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Set to `true` to allow POST /api/admin/seed-demo (use with care). */
  ALLOW_ADMIN_SEED: z.string().default('false'),
  /** When seed-demo runs: if `true`, delete non-admin users and related data before seeding. */
  ADMIN_SEED_CLEAR: z.string().default('false'),
  /** From header, e.g. `RideGuide <you@example.com>` — must match a sender allowed by your SMTP provider (Brevo, etc.). */
  EMAIL_FROM: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  /** Brevo: smtp-relay.brevo.com — or Gmail smtp.gmail.com, etc. */
  SMTP_HOST: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  SMTP_PASS: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  /** Use `true` for port 465; default false (STARTTLS on 587). */
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((s) => s === 'true' || s === '1'),
  /** Local directory for provider verification uploads (relative to cwd). */
  UPLOAD_DIR: z.string().default('uploads'),
});

function load() {
  if (process.env.NODE_ENV === 'test') {
    return schema.parse({
      ...process.env,
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/test',
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret',
      EMAIL_FROM: process.env.EMAIL_FROM?.trim() || undefined,
      SMTP_HOST: process.env.SMTP_HOST?.trim() || undefined,
      SMTP_USER: process.env.SMTP_USER?.trim() || undefined,
      SMTP_PASS: process.env.SMTP_PASS?.trim() || undefined,
    });
  }
  return schema.parse(process.env);
}

export const env = load();
export type Env = typeof env;
