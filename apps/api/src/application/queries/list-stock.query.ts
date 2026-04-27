/**
 * Stock actual de un almacén con valorización + días de cobertura.
 *
 * Una sola query con LEFT JOIN al producto para incluir denormalizados de
 * consumption (last_consumption_at, avg_daily_consumption).
 */
import type { Prisma } from '@brasa/db';
import type { ListStockQuery, StockLevelDTO } from '@brasa/shared-types';

interface RawRow {
  product_id: string;
  sku: string;
  name: { es: string; en: string };
  category_code: string;
  base_unit: string;
  qty_on_hand: string;
  avg_unit_cost: string | null;
  reorder_point: string | null;
  avg_daily_consumption: string | null;
  last_consumption_at: Date | null;
}

export async function listStock(
  tx: Prisma.TransactionClient,
  q: ListStockQuery,
): Promise<StockLevelDTO[]> {
  const rows: RawRow[] = await tx.$queryRaw`
    SELECT
      sl.product_id,
      p.sku,
      p.name,
      pc.code AS category_code,
      p.base_unit,
      sl.qty_on_hand::text,
      sl.avg_unit_cost::text,
      p.reorder_point::text,
      p.avg_daily_consumption::text,
      p.last_consumption_at
    FROM stock_levels sl
    JOIN products p ON p.id = sl.product_id
    JOIN product_categories pc ON pc.id = p.category_id
    WHERE sl.warehouse_id = ${q.warehouseId}::uuid
      ${q.categoryCode ? Prisma.sql`AND pc.code = ${q.categoryCode}` : Prisma.empty}
      ${q.belowReorderOnly ? Prisma.sql`AND p.reorder_point IS NOT NULL AND sl.qty_on_hand < p.reorder_point` : Prisma.empty}
      ${q.negativeOnly ? Prisma.sql`AND sl.qty_on_hand < 0` : Prisma.empty}
    ORDER BY p.sku ASC
  `;

  return rows.map((r) => {
    const qty = Number(r.qty_on_hand);
    const cost = r.avg_unit_cost == null ? null : Number(r.avg_unit_cost);
    const reorder = r.reorder_point == null ? null : Number(r.reorder_point);
    const adc = r.avg_daily_consumption == null ? null : Number(r.avg_daily_consumption);
    return {
      productId: r.product_id,
      productSku: r.sku,
      productName: r.name,
      categoryCode: r.category_code,
      baseUnit: r.base_unit,
      qtyOnHand: qty,
      avgUnitCost: cost,
      totalValue: cost == null ? 0 : qty * cost,
      reorderPoint: reorder,
      isBelowReorder: reorder != null && qty < reorder,
      isNegative: qty < 0,
      daysCoverage: adc != null && adc > 0 ? qty / adc : null,
      lastConsumptionAt: r.last_consumption_at?.toISOString() ?? null,
    };
  });
}
