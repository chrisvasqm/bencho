import type { ErrorRequestHandler, RequestHandler } from 'express';

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new AppError(404, 'NOT_FOUND', `${request.method} ${request.path} not found`));
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details ?? null },
    });
    return;
  }
  const status = statusOf(error);
  if (status === 413) {
    response.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request body is too large.',
        details: null,
      },
    });
    return;
  }
  if (status >= 400 && status < 500) {
    response.status(status).json({
      error: { code: 'BAD_REQUEST', message: 'The request could not be read.', details: null },
    });
    return;
  }
  console.error(error);
  response.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong. Try again.', details: null },
  });
};

/** body-parser and similar set `status` on client errors (malformed JSON, body too large). */
function statusOf(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status } = error as { status: unknown };
    if (typeof status === 'number') return status;
  }
  return 500;
}
