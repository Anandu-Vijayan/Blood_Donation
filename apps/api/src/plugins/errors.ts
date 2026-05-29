import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Validation failed',
        issues: error.issues,
      });
    }

    const statusCode = error.statusCode ?? 500;
    const isProd = process.env.NODE_ENV === 'production';

    request.log.error(error);

    return reply.code(statusCode).send({
      message: error.message || 'Internal Server Error',
      ...(isProd ? {} : { stack: error.stack }),
    });
  });
}
