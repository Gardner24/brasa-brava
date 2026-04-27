import type { FastifyPluginAsync } from 'fastify';
import { ListAuditLogQuery } from '@brasa/shared-types';
import { listAuditLog } from '../../../application/queries/list-audit-log.query.js';
import { DomainError } from '../plugins/error-handler.plugin.js';

export const auditLogRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', {
    preHandler: [app.requirePermission('audit_log.read')],
    schema: {
      tags: ['audit-log'],
      summary: 'Lectura paginada del audit_log',
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const auth = req.auth;
    if (!auth) throw new DomainError('UNAUTHORIZED', 401);
    const query = ListAuditLogQuery.parse(req.query);
    return req.db.tx((tx) => listAuditLog(tx, auth.tenantId, query));
  });
};
