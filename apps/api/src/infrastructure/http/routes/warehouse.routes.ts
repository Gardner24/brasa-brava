import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CreateWarehouseRequest, UpdateWarehouseRequest } from '@brasa/shared-types';
import { listWarehouses } from '../../../application/queries/list-warehouses.query.js';
import {
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from '../../../application/commands/warehouse-commands.js';
import { DomainError } from '../plugins/error-handler.plugin.js';
import type { AuditMutationContext } from '../../../application/shared/audit-helper.js';

const ParamsId = z.object({ id: z.string().uuid() });

export const warehouseRoutes: FastifyPluginAsync = async (app) => {
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
    preHandler: [app.requirePermission('warehouse.read')],
    schema: { tags: ['warehouses'], security: [{ bearerAuth: [] }] },
  }, async (req) => req.db.tx((tx) => listWarehouses(tx)));

  app.post('/', {
    preHandler: [app.requirePermission('warehouse.write')],
    schema: { tags: ['warehouses'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const input = CreateWarehouseRequest.parse(req.body);
    const ctx = buildCtx(req);
    const w = await req.db.tx((tx) => createWarehouse(tx, ctx, input));
    return reply.status(201).send(w);
  });

  app.patch('/:id', {
    preHandler: [app.requirePermission('warehouse.write')],
    schema: { tags: ['warehouses'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const { id } = ParamsId.parse(req.params);
    const input = UpdateWarehouseRequest.parse(req.body);
    const ctx = buildCtx(req);
    return req.db.tx((tx) => updateWarehouse(tx, ctx, id, input));
  });

  app.delete('/:id', {
    preHandler: [app.requirePermission('warehouse.write')],
    schema: { tags: ['warehouses'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const { id } = ParamsId.parse(req.params);
    const ctx = buildCtx(req);
    await req.db.tx((tx) => deleteWarehouse(tx, ctx, id));
    return reply.status(204).send();
  });
};
