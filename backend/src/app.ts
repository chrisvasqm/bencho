import express from 'express';
import { errorHandler, notFoundHandler } from './core/errors.ts';
import { runsRoutes } from './modules/runs/routes.ts';
import type { RunsService } from './modules/runs/service.ts';

export function createApp(runsService: RunsService): express.Express {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/v1/health', (_request, response) => {
    response.json({ ok: true });
  });
  app.use('/api/v1', runsRoutes(runsService));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
