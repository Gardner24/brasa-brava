/**
 * Endpoints de movimientos de stock.
 *   GET  /movements                — listado paginado
 *   POST /movements/purchase       — entrada de compra
 *   POST /movements/consumption    — salida por consumo
 *   POST /movements/waste          — merma con razón
 *   POST /movements/transfer       — transferencia (atómica, 2 movements)
 *   POST /movements/adjustment     — ajuste manual con justificación
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  ListMovementsQuery,
  PurchaseMovementRequest,
  ConsumptionMovementRequest,
  WasteMovementRequest,
  TransferMovementRequest,
  AdjustmentMovementRequest,
} from '@brasa/shared-types';
import { listMovements } from '../../../application/queries/list-movements.query.js';
import {
  registerPurchase,
  registerConsumption,
  registerWaste,
  registerTransfer,
  registerAdjustment,
} from '../../../application/commands/movement-commands.js';
import { DomainError } from '../plugins/error-handler.plugin.js';
import type { AuditMutationContext } from '../../../application/shared/audit-helper.js';

export const movementRoutes: FastifyPluginAsync = async (app) => {
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
    schema: { tags: ['movements'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const q = ListMovementsQuery.parse(req.query);
    return req.db.tx((tx) => listMovements(tx, q));
  });

  app.post('/purchase', {
    preHandler: [app.requirePermission('inventory.move')],
    schema: { tags: ['movements'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const input = PurchaseMovementRequest.parse(req.body);
    const ctx = buildCtx(req);
    const m = await req.db.tx((tx) => registerPurchase(tx, ctx, input));
    return reply.status(201).send(m);
  });

  app.post('/consumption', {
    preHandler: [app.requirePermission('inventory.move')],
    schema: { tags: ['movements'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const input = ConsumptionMovementRequest.parse(req.body);
    const ctx = buildCtx(req);
    const m = await req.db.tx((tx) => registerConsumption(tx, ctx, input));
    return reply.status(201).send(m);
  });

  app.post('/waste', {
    preHandler: [app.requirePermission('inventory.move')],
    schema: { tags: ['movements'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const input = WasteMovementRequest.parse(req.body);
    const ctx = buildCtx(req);
    const m = await req.db.tx((tx) => registerWaste(tx, ctx, input));
    return reply.status(201).send(m);
  });

  app.post('/transfer', {
    preHandler: [app.requirePermission('inventory.move')],
    schema: { tags: ['movements'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const input = TransferMovementRequest.parse(req.body);
    const ctx = buildCtx(req);
    const result = await req.db.tx((tx) => registerTransfer(tx, ctx, input));
    return reply.status(201).send(result);
  });

  app.post('/adjustment', {
    preHandler: [app.requirePermission('inventory.adjust')],
    schema: { tags: ['movements'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const input = AdjustmentMovementRequest.parse(req.body);
    const ctx = buildCtx(req);
    const m = await req.db.tx((tx) => registerAdjustment(tx, ctx, input));
    return reply.status(201).send(m);
  });
};
