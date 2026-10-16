import { Router } from 'express';
import { validate } from '../../core/validate.ts';
import { createRunSchema, listRunsQuerySchema, runIdParamsSchema } from './schema.ts';
import type { RunsService } from './service.ts';

export function runsRoutes(service: RunsService): Router {
  const router = Router();

  router.get('/defaults', (_request, response) => {
    response.json(service.defaults());
  });

  router.get('/runs', validate('query', listRunsQuerySchema), async (_request, response) => {
    response.json({ runs: await service.list(response.locals.query.type) });
  });

  router.post('/runs', validate('body', createRunSchema), async (_request, response) => {
    const run = await service.start(response.locals.body);
    response.status(202).json({ run });
  });

  router.get('/runs/:id', validate('params', runIdParamsSchema), async (_request, response) => {
    response.json({ run: await service.getById(response.locals.params.id) });
  });

  router.get(
    '/runs/:id/points',
    validate('params', runIdParamsSchema),
    async (_request, response) => {
      response.json({ points: await service.listPoints(response.locals.params.id) });
    },
  );

  return router;
}
