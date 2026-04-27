/**
 * Listado de almacenes con métricas agregadas:
 *  - itemsCount: # de productos con qty > 0 en este almacén
 *  - totalValueCRC: SUM(qty * avg_unit_cost) sobre stock_levels del almacén
 *  - openAlertsCount: # alertas no-resueltas para este almacén
 *
 * Una sola query con CTE — escala bien a cientos de almacenes.
 */
import type { Prisma } from '@brasa/db';
import type { WarehouseDTO } from '@brasa/shared-types';

interface RawRow {
  id: string;
  code: string;
  display_name: string;
  is_active: boolean;
  created_at: Date;
  items_count: bigint;
  total_value: string | null;
  open_alerts_count: bigint;
}

export async function listWarehouses(tx: Prisma.TransactionClient): Promise<WarehouseDTO[]> {
  const rows: RawRow[] = await tx.$queryRaw`
    SELECT
      w.id,
      w.code,
      w.display_name,
      w.is_active,
      w.created_at,
      COALESCE((
        SELECT COUNT(*)::bigint FROM stock_levels sl
        WHERE sl.warehouse_id = w.id AND sl.qty_on_hand > 0
      ), 0) AS items_count,
      COALESCE((
        SELECT SUM(sl.qty_on_hand * COALESCE(sl.avg_unit_cost, 0))::text FROM stock_levels sl
        WHERE sl.warehouse_id = w.id AND sl.qty_on_hand > 0
      ), '0') AS total_value,
      COALESCE((
        SELECT COUNT(*)::bigint FROM low_stock_alerts a
        WHERE a.warehouse_id = w.id AND a.resolved_at IS NULL
      ), 0) AS open_alerts_count
    FROM warehouses w
    ORDER BY w.is_active DESC, w.code ASC
  `;

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    displayName: r.display_name,
    isActive: r.is_active,
    itemsCount: Number(r.items_count),
    totalValueCRC: r.total_value == null ? 0 : Number(r.total_value),
    openAlertsCount: Number(r.open_alerts_count),
    createdAt: r.created_at.toISOString(),
  }));
}
