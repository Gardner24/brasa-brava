import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ListStockQuery } from '@brasa/shared-types';
import { listStock } from '../../../application/queries/list-stock.query.js';
import { stockValuation } from '../../../application/queries/stock-valuation.query.js';

const ValuationQuery = z.object({ warehouseId: z.string().uuid() });

export const stockRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', {
    preHandler: [app.requirePermission('inventory.read')],
    schema: { tags: ['stock'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const q = ListStockQuery.parse(req.query);
    return req.db.tx((tx) => listStock(tx, q));
  });

  app.get('/valuation', {
    preHandler: [app.requirePermission('inventory.read')],
    schema: { tags: ['stock'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const { warehouseId } = ValuationQuery.parse(req.query);
    return req.db.tx((tx) => stockValuation(tx, warehouseId));
  });
};
