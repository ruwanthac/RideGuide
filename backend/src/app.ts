import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import api from './routes';
import { errorHandler } from './middleware/errorHandler';

export function buildApp(): Application {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, env: env.NODE_ENV });
  });

  const authLimiter = rateLimit({ windowMs: 60_000, max: 60 });
  app.use('/api/auth', authLimiter);

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
