/**
 * Error handler centralizado: traduce excepciones del dominio + Zod + Prisma
 * a respuestas estables con `code` (no mensaje traducido — eso lo hace el frontend).
 */
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { Prisma } from '@brasa/db';
import { ErrorCodes, type ApiErrorBody } from '@brasa/shared-types';

export class DomainError extends Error {
  constructor(
    public readonly code: keyof typeof ErrorCodes,
    public readonly statusCode: number,
    public readonly params?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'DomainError';
  }
}

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((err, req, reply) => {
    const requestId = req.id;

    // Errores de dominio explícitos
    if (err instanceof DomainError) {
      const body: ApiErrorBody = {
        code: ErrorCodes[err.code],
        ...(err.params !== undefined ? { params: err.params } : {}),
        requestId,
      };
      req.log.info({ err, statusCode: err.statusCode }, 'domain error');
      return reply.status(err.statusCode).send(body);
    }

    // Validación Zod
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of err.issues) {
        const key = issue.path.join('.') || '_';
        (fieldErrors[key] ??= []).push(issue.code);
      }
      const body: ApiErrorBody = {
        code: ErrorCodes.VALIDATION_FAILED,
        fieldErrors,
        requestId,
      };
      req.log.info({ err }, 'validation error');
      return reply.status(400).send(body);
    }

    // Prisma — known
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint
      if (err.code === 'P2002') {
        const body: ApiErrorBody = {
          code: ErrorCodes.CONFLICT,
          params: { target: err.meta?.['target'] },
          requestId,
        };
        return reply.status(409).send(body);
      }
      // Not found
      if (err.code === 'P2025') {
        const body: ApiErrorBody = { code: ErrorCodes.NOT_FOUND, requestId };
        return reply.status(404).send(body);
      }
    }

    // Auth (de @fastify/jwt)
    if (err.statusCode === 401) {
      const body: ApiErrorBody = { code: ErrorCodes.UNAUTHORIZED, requestId };
      return reply.status(401).send(body);
    }

    // Rate limit
    if (err.statusCode === 429) {
      const body: ApiErrorBody = { code: ErrorCodes.RATE_LIMITED, requestId };
      return reply.status(429).send(body);
    }

    // Fallback
    req.log.error({ err }, 'unhandled error');
    const body: ApiErrorBody = {
      code: ErrorCodes.INTERNAL,
      requestId,
      message: app.env.NODE_ENV === 'production' ? undefined : err.message,
    };
    return reply.status(err.statusCode ?? 500).send(body);
  });
});
