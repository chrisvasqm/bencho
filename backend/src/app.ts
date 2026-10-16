import express from 'express';
import { AppError, errorHandler, notFoundHandler } from './core/errors.ts';
import { runsRoutes } from './modules/runs/routes.ts';
import type { RunsService } from './modules/runs/service.ts';

export interface AppDependencies {
  runsService: RunsService;
  /** Rejects when the database is unreachable; backs the health check. */
  checkDatabase: () => Promise<void>;
}

export function createApp({ runsService, checkDatabase }: AppDependencies): express.Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/v1/health', async (_request, response) => {
    try {
      await checkDatabase();
    } catch (error) {
      console.error(
        'health: database check failed',
        error instanceof Error ? error.message : error,
      );
      throw new AppError(503, 'DATABASE_UNAVAILABLE', 'The database is not reachable.');
    }
    response.json({ ok: true });
  });
  app.use('/api/v1', runsRoutes(runsService));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
