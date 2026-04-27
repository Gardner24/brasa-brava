import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CreateCategoryRequest, UpdateCategoryRequest } from '@brasa/shared-types';
import { listCategories } from '../../../application/queries/list-categories.query.js';
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../../application/commands/category-commands.js';
import { DomainError } from '../plugins/error-handler.plugin.js';
import type { AuditMutationContext } from '../../../application/shared/audit-helper.js';

const ParamsId = z.object({ id: z.string().uuid() });

export const categoryRoutes: FastifyPluginAsync = async (app) => {
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
    preHandler: [app.requirePermission('category.read')],
    schema: { tags: ['categories'], security: [{ bearerAuth: [] }] },
  }, async (req) => req.db.tx((tx) => listCategories(tx)));

  app.post('/', {
    preHandler: [app.requirePermission('category.write')],
    schema: { tags: ['categories'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const input = CreateCategoryRequest.parse(req.body);
    const ctx = buildCtx(req);
    const cat = await req.db.tx((tx) => createCategory(tx, ctx, input));
    return reply.status(201).send(cat);
  });

  app.patch('/:id', {
    preHandler: [app.requirePermission('category.write')],
    schema: { tags: ['categories'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const { id } = ParamsId.parse(req.params);
    const input = UpdateCategoryRequest.parse(req.body);
    const ctx = buildCtx(req);
    return req.db.tx((tx) => updateCategory(tx, ctx, id, input));
  });

  app.delete('/:id', {
    preHandler: [app.requirePermission('category.write')],
    schema: { tags: ['categories'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const { id } = ParamsId.parse(req.params);
    const ctx = buildCtx(req);
    await req.db.tx((tx) => deleteCategory(tx, ctx, id));
    return reply.status(204).send();
  });
};
