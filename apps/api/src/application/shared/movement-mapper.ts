import type { Prisma, StockMovement, Product, Warehouse } from '@brasa/db';
import type { StockMovementDTO } from '@brasa/shared-types';

type MovementWithRefs = StockMovement & {
  product: Pick<Product, 'sku' | 'name'>;
  warehouse: Pick<Warehouse, 'code'>;
};

export function toMovementDTO(m: MovementWithRefs): StockMovementDTO {
  const qty = Number(m.qty);
  const cost = m.unitCost == null ? null : Number(m.unitCost);
  return {
    id: m.id,
    productId: m.productId,
    productSku: m.product.sku,
    productName: m.product.name as { es: string; en: string },
    warehouseId: m.warehouseId,
    warehouseCode: m.warehouse.code,
    movementType: m.movementType,
    qty,
    unitCost: cost,
    totalValue: cost == null ? 0 : qty * cost,
    wasteReason: m.wasteReason,
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    pairedMovementId: m.pairedMovementId,
    notes: m.notes,
    performedAt: m.performedAt.toISOString(),
    performedById: m.performedById,
  };
}
