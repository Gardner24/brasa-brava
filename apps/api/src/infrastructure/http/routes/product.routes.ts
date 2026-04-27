/**
 * CRUD completo de productos:
 *   GET    /products                     — listado paginado con filtros
 *   GET    /products/:id                 — detalle (categoría + aliases + price history + uso)
 *   POST   /products                     — crear
 *   PATCH  /products/:id                 — editar (optimistic concurrency)
 *   DELETE /products/:id                 — archivar (soft, con detección de dependencias)
 *   GET    /products/:id/price-history   — histórico paginado
 *   POST   /products/:id/aliases         — añadir alias
 *   DELETE /products/:id/aliases/:aliasId — eliminar alias
 *
 * Cada mutación pasa por audit_log via el `audit-helper`.
 * Permisos: lectura = 'product.read', escritura = 'product.write',
 * archivado = 'product.archive', aliases = 'product.write'.
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  ListProductsQuery,
  CreateProductRequest,
  UpdateProductRequest,
  AddAliasRequest,
  ListPriceHistoryQuery,
} from '@brasa/shared-types';
import { z } from 'zod';
import { listProducts } from '../../../application/queries/list-products.query.js';
import { getProductDetail } from '../../../application/queries/get-product-detail.query.js';
import { listPriceHistory } from '../../../application/queries/list-price-history.query.js';
import { createProduct } from '../../../application/commands/create-product.command.js';
import { updateProduct } from '../../../application/commands/update-product.command.js';
import { archiveProduct } from '../../../application/commands/archive-product.command.js';
import {
  addProductAlias,
  removeProductAlias,
} from '../../../application/commands/product-aliases.command.js';
import { DomainError } from '../plugins/error-handler.plugin.js';
import type { AuditMutationContext } from '../../../application/shared/audit-helper.js';

const ParamsId = z.object({ id: z.string().uuid() });
const ParamsAlias = z.object({ id: z.string().uuid(), aliasId: z.string().uuid() });
const ArchiveQuery = z.object({
  expectedVersion: z.coerce.number().int().nonnegative(),
  force: z.coerce.boolean().optional().default(false),
});

export const productRoutes: FastifyPluginAsync = async (app) => {
  // Construye el contexto de mutación desde el request
  const buildCtx = (req: import('fastify').FastifyRequest): AuditMutationContext => {
    const auth = req.auth;
    if (!auth) throw new DomainError('UNAUTHORIZED', 401);
    return {
      app,
      tenantId: auth.tenantId,
      actorId: auth.userId,
      actorEmail: '(via-token)', // El email real lo resolvemos en commands si lo necesitamos.
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
  };

  // ===== GET /products =====
  app.get('/', {
    preHandler: [app.requirePermission('product.read')],
    schema: {
      tags: ['products'],
      summary: 'Listar productos paginados',
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const query = ListProductsQuery.parse(req.query);
    return req.db.tx((tx) => listProducts(tx, query));
  });

  // ===== GET /products/:id =====
  app.get('/:id', {
    preHandler: [app.requirePermission('product.read')],
    schema: { tags: ['products'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const { id } = ParamsId.parse(req.params);
    return req.db.tx((tx) => getProductDetail(tx, id));
  });

  // ===== POST /products =====
  app.post('/', {
    preHandler: [app.requirePermission('product.write')],
    schema: {
      tags: ['products'],
      summary: 'Crear producto',
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const input = CreateProductRequest.parse(req.body);
    const ctx = buildCtx(req);
    const product = await req.db.tx((tx) => createProduct(tx, ctx, input));
    return reply.status(201).send(product);
  });

  // ===== PATCH /products/:id =====
  app.patch('/:id', {
    preHandler: [app.requirePermission('product.write')],
    schema: {
      tags: ['products'],
      summary: 'Editar producto (optimistic locking)',
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const { id } = ParamsId.parse(req.params);
    const input = UpdateProductRequest.parse(req.body);
    const ctx = buildCtx(req);
    return req.db.tx((tx) => updateProduct(tx, ctx, id, input));
  });

  // ===== DELETE /products/:id =====
  app.delete('/:id', {
    preHandler: [app.requirePermission('product.write')],
    schema: {
      tags: ['products'],
      summary: 'Archivar producto (soft delete)',
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const { id } = ParamsId.parse(req.params);
    const { expectedVersion, force } = ArchiveQuery.parse(req.query);
    const ctx = buildCtx(req);
    return req.db.tx((tx) => archiveProduct(tx, ctx, id, { expectedVersion, force }));
  });

  // ===== GET /products/:id/price-history =====
  app.get('/:id/price-history', {
    preHandler: [app.requirePermission('product.read')],
    schema: { tags: ['products'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const { id } = ParamsId.parse(req.params);
    const q = ListPriceHistoryQuery.parse(req.query);
    return req.db.tx((tx) => listPriceHistory(tx, id, q));
  });

  // ===== POST /products/:id/aliases =====
  app.post('/:id/aliases', {
    preHandler: [app.requirePermission('product.write')],
    schema: { tags: ['products'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const { id } = ParamsId.parse(req.params);
    const { alias } = AddAliasRequest.parse(req.body);
    const ctx = buildCtx(req);
    const created = await req.db.tx((tx) => addProductAlias(tx, ctx, id, alias));
    return reply.status(201).send(created);
  });

  // ===== DELETE /products/:id/aliases/:aliasId =====
  app.delete('/:id/aliases/:aliasId', {
    preHandler: [app.requirePermission('product.write')],
    schema: { tags: ['products'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const { id, aliasId } = ParamsAlias.parse(req.params);
    const ctx = buildCtx(req);
    await req.db.tx((tx) => removeProductAlias(tx, ctx, id, aliasId));
    return reply.status(204).send();
  });
};
