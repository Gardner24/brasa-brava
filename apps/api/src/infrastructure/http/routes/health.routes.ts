import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@brasa/db';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => ({ status: 'ok', uptime: process.uptime() }));

  app.get('/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch (err) {
      app.log.error({ err }, 'health check failed');
      return reply.status(503).send({ status: 'not_ready' });
    }
  });
};
