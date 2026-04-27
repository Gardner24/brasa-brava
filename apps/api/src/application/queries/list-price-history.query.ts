/**
 * Query: histórico de precios paginado de un producto.
 */
import type { Prisma } from '@brasa/db';
import type { ListPriceHistoryQuery, PriceHistoryEntryDTO } from '@brasa/shared-types';

export interface ListPriceHistoryResult {
  data: PriceHistoryEntryDTO[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listPriceHistory(
  tx: Prisma.TransactionClient,
  productId: string,
  q: ListPriceHistoryQuery,
): Promise<ListPriceHistoryResult> {
  const where: Prisma.ProductPriceHistoryWhereInput = { productId };

  const [total, rows] = await Promise.all([
    tx.productPriceHistory.count({ where }),
    tx.productPriceHistory.findMany({
      where,
      orderBy: { effectiveAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  const data: PriceHistoryEntryDTO[] = rows.map((h) => {
    const cost = Number(h.packageCost);
    const size = Number(h.packageSize);
    return {
      id: h.id,
      productId: h.productId,
      packageCost: cost,
      packageSize: size,
      unitCost: size > 0 ? cost / size : 0,
      effectiveAt: h.effectiveAt.toISOString(),
      source: h.source,
      createdById: h.createdById,
    };
  });

  return { data, page: q.page, pageSize: q.pageSize, total };
}
