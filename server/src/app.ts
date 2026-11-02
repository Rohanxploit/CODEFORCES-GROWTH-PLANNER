import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createApiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export interface AppOptions {
  corsOrigins: string[];
  /** Number of reverse-proxy hops to trust for the client IP. */
  trustProxy?: number;
}

/** Builds the Express app without starting it, so tests can drive it directly. */
export function createApp({ corsOrigins, trustProxy = 1 }: AppOptions) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', createApiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
