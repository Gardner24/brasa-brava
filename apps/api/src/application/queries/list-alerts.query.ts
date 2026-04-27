/**
 * Listado de alertas de stock bajo.
 * Por defecto solo no-resueltas. Hace JOIN al stock actual para mostrar
 * tanto el qty al momento de raise como el qty actual (puede haber
 * cambiado entre raise y consulta).
 */
import { Prisma } from '@brasa/db';
import type { ListAlertsQuery, LowStockAlertDTO } from '@brasa/shared-types';

interface RawRow {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: { es: string; en: string };
  warehouse_id: string;
  warehouse_code: string;
  qty_on_hand_at_raise: string;
  qty_on_hand_now: string;
  reorder_point: string;
  raised_at: Date;
  resolved_at: Date | null;
  resolved_by_id: string | null;
}

export interface ListAlertsResult {
  data: LowStockAlertDTO[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listAlerts(
  tx: Prisma.TransactionClient,
  q: ListAlertsQuery,
): Promise<ListAlertsResult> {
  const showResolved = q.resolved === true;
  const offset = (q.page - 1) * q.pageSize;

  const totalRows: { count: bigint }[] = await tx.$queryRaw`
    SELECT COUNT(*)::bigint AS count
    FROM low_stock_alerts a
    WHERE 1=1
      ${q.warehouseId ? Prisma.sql`AND a.warehouse_id = ${q.warehouseId}::uuid` : Prisma.empty}
      ${showResolved ? Prisma.empty : Prisma.sql`AND a.resolved_at IS NULL`}
  `;
  const total = Number(totalRows[0]?.count ?? 0);

  const rows: RawRow[] = await tx.$queryRaw`
    SELECT
      a.id,
      a.product_id,
      p.sku AS product_sku,
      p.name AS product_name,
      a.warehouse_id,
      w.code AS warehouse_code,
      a.qty_on_hand::text AS qty_on_hand_at_raise,
      COALESCE(sl.qty_on_hand, 0)::text AS qty_on_hand_now,
      a.reorder_point::text,
      a.raised_at,
      a.resolved_at,
      a.resolved_by_id
    FROM low_stock_alerts a
    JOIN products p   ON p.id = a.product_id
    JOIN warehouses w ON w.id = a.warehouse_id
    LEFT JOIN stock_levels sl
      ON sl.product_id = a.product_id AND sl.warehouse_id = a.warehouse_id
    WHERE 1=1
      ${q.warehouseId ? Prisma.sql`AND a.warehouse_id = ${q.warehouseId}::uuid` : Prisma.empty}
      ${showResolved ? Prisma.empty : Prisma.sql`AND a.resolved_at IS NULL`}
    ORDER BY a.raised_at DESC
    LIMIT ${q.pageSize} OFFSET ${offset}
  `;

  const data: LowStockAlertDTO[] = rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productSku: r.product_sku,
    productName: r.product_name,
    warehouseId: r.warehouse_id,
    warehouseCode: r.warehouse_code,
    qtyOnHandAtRaise: Number(r.qty_on_hand_at_raise),
    qtyOnHandNow: Number(r.qty_on_hand_now),
    reorderPoint: Number(r.reorder_point),
    raisedAt: r.raised_at.toISOString(),
    resolvedAt: r.resolved_at?.toISOString() ?? null,
    resolvedById: r.resolved_by_id,
  }));

  return { data, page: q.page, pageSize: q.pageSize, total };
}
