/**
 * Listado paginado del libro mayor de movimientos.
 */
import type { Prisma } from '@brasa/db';
import type { ListMovementsQuery, StockMovementDTO } from '@brasa/shared-types';
import { toMovementDTO } from '../shared/movement-mapper.js';

export interface ListMovementsResult {
  data: StockMovementDTO[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listMovements(
  tx: Prisma.TransactionClient,
  q: ListMovementsQuery,
): Promise<ListMovementsResult> {
  const where: Prisma.StockMovementWhereInput = {};
  if (q.warehouseId) where.warehouseId = q.warehouseId;
  if (q.productId) where.productId = q.productId;
  if (q.movementType) where.movementType = q.movementType;
  if (q.fromDate || q.toDate) {
    where.performedAt = {
      ...(q.fromDate ? { gte: new Date(q.fromDate) } : {}),
      ...(q.toDate ? { lte: new Date(q.toDate) } : {}),
    };
  }

  const [total, rows] = await Promise.all([
    tx.stockMovement.count({ where }),
    tx.stockMovement.findMany({
      where,
      include: {
        product: { select: { sku: true, name: true } },
        warehouse: { select: { code: true } },
      },
      orderBy: { performedAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  return {
    data: rows.map(toMovementDTO),
    page: q.page,
    pageSize: q.pageSize,
    total,
  };
}
