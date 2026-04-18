import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  GEMINI_API_KEY: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().default('*'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

function load() {
  if (process.env.NODE_ENV === 'test') {
    return schema.parse({
      ...process.env,
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/test',
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret',
    });
  }
  return schema.parse(process.env);
}

export const env = load();
export type Env = typeof env;
