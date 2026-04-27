import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ListAlertsQuery, ResolveAlertRequest } from '@brasa/shared-types';
import { listAlerts } from '../../../application/queries/list-alerts.query.js';
import { resolveAlert } from '../../../application/commands/resolve-alert.command.js';
import { DomainError } from '../plugins/error-handler.plugin.js';
import type { AuditMutationContext } from '../../../application/shared/audit-helper.js';

const ParamsId = z.object({ id: z.string().uuid() });

export const alertRoutes: FastifyPluginAsync = async (app) => {
  const buildCtx = (req: import('fastify').FastifyRequest): AuditMutationContext => {
    const auth = req.auth;
    if (!auth) throw new DomainError('UNAUTHORIZED', 401);
    return {
      app,
      tenantId: auth.tenantId,
      actorId: auth.userId,
      actorEmail: '(via-token)',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
  };

  app.get('/', {
    preHandler: [app.requirePermission('inventory.read')],
    schema: { tags: ['alerts'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const q = ListAlertsQuery.parse(req.query);
    return req.db.tx((tx) => listAlerts(tx, q));
  });

  app.post('/:id/resolve', {
    preHandler: [app.requirePermission('inventory.move')],
    schema: { tags: ['alerts'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const { id } = ParamsId.parse(req.params);
    const { notes } = ResolveAlertRequest.parse(req.body ?? {});
    const ctx = buildCtx(req);
    await req.db.tx((tx) => resolveAlert(tx, ctx, id, notes));
    return reply.status(204).send();
  });
};
