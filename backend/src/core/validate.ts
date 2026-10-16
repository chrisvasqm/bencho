import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from './errors.ts';

type Part = 'body' | 'query' | 'params';

/** Parses one request part with Zod and stores the typed result on response.locals[part]. */
export function validate(part: Part, schema: ZodType): RequestHandler {
  return (request, response, next) => {
    const parsed = schema.safeParse(request[part]);
    if (!parsed.success) {
      next(new AppError(400, 'VALIDATION', `Invalid ${part}`, parsed.error.issues));
      return;
    }
    response.locals[part] = parsed.data;
    next();
  };
}
