/**
 * Valorización agregada por categoría para un almacén.
 */
import type { Prisma } from '@brasa/db';
import type { StockValuationByCategoryDTO } from '@brasa/shared-types';

interface RawRow {
  category_code: string;
  items_count: bigint;
  total_value: string;
}

export async function stockValuation(
  tx: Prisma.TransactionClient,
  warehouseId: string,
): Promise<StockValuationByCategoryDTO> {
  const rows: RawRow[] = await tx.$queryRaw`
    SELECT
      pc.code AS category_code,
      COUNT(*)::bigint AS items_count,
      COALESCE(SUM(sl.qty_on_hand * COALESCE(sl.avg_unit_cost, 0)), 0)::text AS total_value
    FROM stock_levels sl
    JOIN products p ON p.id = sl.product_id
    JOIN product_categories pc ON pc.id = p.category_id
    WHERE sl.warehouse_id = ${warehouseId}::uuid
      AND sl.qty_on_hand > 0
    GROUP BY pc.code
    ORDER BY total_value DESC
  `;

  const totals = rows.map((r) => ({
    categoryCode: r.category_code,
    itemsCount: Number(r.items_count),
    totalValueCRC: Number(r.total_value),
  }));
  const grandTotalCRC = totals.reduce((sum, t) => sum + t.totalValueCRC, 0);

  return { warehouseId, totals, grandTotalCRC };
}
