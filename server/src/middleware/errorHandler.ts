import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError, z } from 'zod';
import type { ApiErrorBody } from '@cgp/shared';
import { AppError } from '../utils/AppError.js';
import { CodeforcesError, codeforcesErrorStatus } from '../services/codeforces.service.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let body: ApiErrorBody;
  let status: number;

  if (err instanceof AppError) {
    status = err.statusCode;
    body = { error: { code: err.code, message: err.message, details: err.details } };
  } else if (err instanceof ZodError) {
    status = 400;
    const first = err.issues[0];
    const message = first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid request data';
    body = { error: { code: 'VALIDATION_ERROR', message, details: z.flattenError(err) } };
  } else if (err instanceof CodeforcesError) {
    status = codeforcesErrorStatus(err.kind);
    body = { error: { code: `CODEFORCES_${err.kind}`, message: err.message } };
  } else if (err instanceof RangeError) {
    status = 400;
    body = { error: { code: 'VALIDATION_ERROR', message: err.message } };
  } else if (err instanceof mongoose.Error.CastError) {
    status = 404;
    body = { error: { code: 'NOT_FOUND', message: 'Resource not found' } };
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    body = { error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } };
  } else if (err?.code === 11000) {
    status = 409;
    body = { error: { code: 'CONFLICT', message: 'That resource already exists' } };
  } else {
    // Unknown errors never leak internals to the client.
    logger.error('Unhandled error', err);
    status = 500;
    body = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } };
  }

  res.status(status).json(body);
};
