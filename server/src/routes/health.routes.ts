import { Router } from 'express';
import type { HealthResponse } from '@cgp/shared';
import { databaseState } from '../config/db.js';

export const healthRouter = Router();

// Used by Render's health check and by the client to show server status.
healthRouter.get('/', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    database: databaseState(),
    timestamp: new Date().toISOString(),
  };
  res.json(body);
});
