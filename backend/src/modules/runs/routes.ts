import { Router } from 'express';
import { validate } from '../../core/validate.ts';
import {
  bulkDeleteSchema,
  createRunSchema,
  listRunsQuerySchema,
  runIdParamsSchema,
} from './schema.ts';
import type { RunsService } from './service.ts';

export function runsRoutes(service: RunsService): Router {
  const router = Router();

  router.get('/defaults', (_request, response) => {
    response.json(service.defaults());
  });

  router.get('/capacity', (_request, response) => {
    response.json(service.capacity());
  });

  router.get('/runs', validate('query', listRunsQuerySchema), async (_request, response) => {
    response.json(await service.list(response.locals.query));
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

  router.post('/runs/delete', validate('body', bulkDeleteSchema), async (_request, response) => {
    response.json(await service.deleteMany(response.locals.body.ids));
  });

  router.post(
    '/runs/:id/stop',
    validate('params', runIdParamsSchema),
    async (_request, response) => {
      response.status(202).json({ run: await service.stop(response.locals.params.id) });
    },
  );

  router.delete('/runs/:id', validate('params', runIdParamsSchema), async (_request, response) => {
    await service.delete(response.locals.params.id);
    response.status(204).end();
  });

  return router;
}
