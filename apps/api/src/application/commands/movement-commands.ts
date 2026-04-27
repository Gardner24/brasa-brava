/**
 * Comandos de movimiento de inventario.
 *
 * Reglas comunes:
 *  - El trigger DB `apply_stock_movement` actualiza stock_levels y avg_unit_cost
 *  - El trigger DB `evaluate_low_stock_alert` levanta/cierra alertas
 *  - Stock negativo PERMITIDO (decisión D2) — solo loggeamos warning
 *  - Audit log via referenceType='STOCK_MOVEMENT' implícito
 *
 * Convenciones de signo en stock_movements.qty:
 *  - PURCHASE / TRANSFER_IN / RETURN / INITIAL → positivo
 *  - CONSUMPTION / WASTE / TRANSFER_OUT → negativo
 *  - ADJUSTMENT → libre (positivo o negativo según el caso)
 */
import { Prisma } from '@brasa/db';
import type {
  PurchaseMovementRequest,
  ConsumptionMovementRequest,
  WasteMovementRequest,
  TransferMovementRequest,
  AdjustmentMovementRequest,
  StockMovementDTO,
} from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';
import { toMovementDTO } from '../shared/movement-mapper.js';

interface ProductGuardOptions {
  /** Permite registrar movimientos sobre productos en cuarentena (solo para PURCHASE/INITIAL). */
  allowQuarantined?: boolean;
}

async function assertProduct(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productId: string,
  options: ProductGuardOptions = {},
) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product || product.tenantId !== tenantId) {
    throw new DomainError('NOT_FOUND', 404);
  }
  if (!product.isActive && !options.allowQuarantined) {
    throw new DomainError('MOVEMENT_PRODUCT_INACTIVE', 409, { sku: product.sku });
  }
  return product;
}

async function assertWarehouse(tx: Prisma.TransactionClient, tenantId: string, warehouseId: string) {
  const w = await tx.warehouse.findUnique({ where: { id: warehouseId } });
  if (!w || w.tenantId !== tenantId) throw new DomainError('NOT_FOUND', 404);
  if (!w.isActive) throw new DomainError('WAREHOUSE_INACTIVE', 409, { code: w.code });
  return w;
}

async function fetchMovementWithRefs(tx: Prisma.TransactionClient, id: string) {
  return tx.stockMovement.findUniqueOrThrow({
    where: { id },
    include: {
      product: { select: { sku: true, name: true } },
      warehouse: { select: { code: true } },
    },
  });
}

// =================== PURCHASE ===================

export async function registerPurchase(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  input: PurchaseMovementRequest,
): Promise<StockMovementDTO> {
  await assertProduct(tx, ctx.tenantId, input.productId, { allowQuarantined: true });
  await assertWarehouse(tx, ctx.tenantId, input.warehouseId);
  if (input.qty <= 0) throw new DomainError('MOVEMENT_INVALID_QTY', 400);

  const created = await tx.stockMovement.create({
    data: {
      tenantId: ctx.tenantId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      movementType: 'PURCHASE',
      qty: input.qty,
      unitCost: input.unitCost,
      notes: input.notes ?? null,
      performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
      performedById: ctx.actorId,
    },
  });

  const fresh = await fetchMovementWithRefs(tx, created.id);
  const dto = toMovementDTO(fresh);
  await recordMutation(ctx, {
    entity: 'stock_movement',
    entityId: created.id,
    action: 'INSERT',
    after: dto,
  });
  return dto;
}

// =================== CONSUMPTION ===================

export async function registerConsumption(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  input: ConsumptionMovementRequest,
): Promise<StockMovementDTO> {
  await assertProduct(tx, ctx.tenantId, input.productId);
  await assertWarehouse(tx, ctx.tenantId, input.warehouseId);
  if (input.qty <= 0) throw new DomainError('MOVEMENT_INVALID_QTY', 400);

  // Costo unit del CONSUMPTION = avg_unit_cost actual del stock_level (snapshot).
  // Si nunca se compró (cost null), CONSUMPTION sale con null y el trigger no
  // recalcula avg (mantiene el actual). En reportes saldrá como "salida sin costo".
  const stockLevel = await tx.stockLevel.findUnique({
    where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
  });
  const snapshotCost = stockLevel?.avgUnitCost ? Number(stockLevel.avgUnitCost) : null;

  const created = await tx.stockMovement.create({
    data: {
      tenantId: ctx.tenantId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      movementType: 'CONSUMPTION',
      qty: -input.qty, // signo negativo
      unitCost: snapshotCost,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      notes: input.notes ?? null,
      performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
      performedById: ctx.actorId,
    },
  });

  const fresh = await fetchMovementWithRefs(tx, created.id);
  const dto = toMovementDTO(fresh);
  await recordMutation(ctx, {
    entity: 'stock_movement',
    entityId: created.id,
    action: 'INSERT',
    after: dto,
  });
  return dto;
}

// =================== WASTE ===================

export async function registerWaste(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  input: WasteMovementRequest,
): Promise<StockMovementDTO> {
  await assertProduct(tx, ctx.tenantId, input.productId);
  await assertWarehouse(tx, ctx.tenantId, input.warehouseId);
  if (input.qty <= 0) throw new DomainError('MOVEMENT_INVALID_QTY', 400);

  const stockLevel = await tx.stockLevel.findUnique({
    where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
  });
  const snapshotCost = stockLevel?.avgUnitCost ? Number(stockLevel.avgUnitCost) : null;

  const created = await tx.stockMovement.create({
    data: {
      tenantId: ctx.tenantId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      movementType: 'WASTE',
      qty: -input.qty,
      unitCost: snapshotCost,
      wasteReason: input.wasteReason,
      notes: input.notes ?? null,
      performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
      performedById: ctx.actorId,
    },
  });

  const fresh = await fetchMovementWithRefs(tx, created.id);
  const dto = toMovementDTO(fresh);
  await recordMutation(ctx, {
    entity: 'stock_movement',
    entityId: created.id,
    action: 'INSERT',
    after: dto,
  });
  return dto;
}

// =================== TRANSFER ===================
// Genera 2 movements atómicos: TRANSFER_OUT desde origen + TRANSFER_IN en destino,
// linkeados via paired_movement_id. Si una falla, ambas se hacen rollback.

export async function registerTransfer(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  input: TransferMovementRequest,
): Promise<{ out: StockMovementDTO; in: StockMovementDTO }> {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new DomainError('TRANSFER_SAME_WAREHOUSE', 400);
  }
  await assertProduct(tx, ctx.tenantId, input.productId);
  await assertWarehouse(tx, ctx.tenantId, input.fromWarehouseId);
  await assertWarehouse(tx, ctx.tenantId, input.toWarehouseId);
  if (input.qty <= 0) throw new DomainError('MOVEMENT_INVALID_QTY', 400);

  // Snapshot del costo desde el stock origen — el destino "hereda" ese costo
  const fromLevel = await tx.stockLevel.findUnique({
    where: {
      productId_warehouseId: {
        productId: input.productId,
        warehouseId: input.fromWarehouseId,
      },
    },
  });
  const snapshotCost = fromLevel?.avgUnitCost ? Number(fromLevel.avgUnitCost) : null;
  const performedAt = input.performedAt ? new Date(input.performedAt) : new Date();

  const movOut = await tx.stockMovement.create({
    data: {
      tenantId: ctx.tenantId,
      productId: input.productId,
      warehouseId: input.fromWarehouseId,
      movementType: 'TRANSFER_OUT',
      qty: -input.qty,
      unitCost: snapshotCost,
      notes: input.notes ?? null,
      performedAt,
      performedById: ctx.actorId,
    },
  });

  const movIn = await tx.stockMovement.create({
    data: {
      tenantId: ctx.tenantId,
      productId: input.productId,
      warehouseId: input.toWarehouseId,
      movementType: 'TRANSFER_IN',
      qty: input.qty,
      unitCost: snapshotCost,
      pairedMovementId: movOut.id,
      notes: input.notes ?? null,
      performedAt,
      performedById: ctx.actorId,
    },
  });

  // Linkear bidireccional: el OUT ahora apunta al IN
  await tx.stockMovement.update({
    where: { id: movOut.id },
    data: { pairedMovementId: movIn.id },
  });

  const freshOut = await fetchMovementWithRefs(tx, movOut.id);
  const freshIn = await fetchMovementWithRefs(tx, movIn.id);
  const dtoOut = toMovementDTO(freshOut);
  const dtoIn = toMovementDTO(freshIn);

  await recordMutation(ctx, {
    entity: 'stock_movement',
    entityId: movOut.id,
    action: 'INSERT',
    after: { out: dtoOut, in: dtoIn },
  });

  return { out: dtoOut, in: dtoIn };
}

// =================== ADJUSTMENT ===================
// Ajustes manuales — usado por auditoría (Fase 4) y por correcciones puntuales.
// Notes obligatorios (decisión: ningún ajuste sin justificación).

export async function registerAdjustment(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  input: AdjustmentMovementRequest,
): Promise<StockMovementDTO> {
  await assertProduct(tx, ctx.tenantId, input.productId);
  await assertWarehouse(tx, ctx.tenantId, input.warehouseId);
  if (input.qty === 0) throw new DomainError('MOVEMENT_INVALID_QTY', 400);

  const stockLevel = await tx.stockLevel.findUnique({
    where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
  });
  const snapshotCost = stockLevel?.avgUnitCost ? Number(stockLevel.avgUnitCost) : null;

  const created = await tx.stockMovement.create({
    data: {
      tenantId: ctx.tenantId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      movementType: 'ADJUSTMENT',
      qty: input.qty,
      unitCost: snapshotCost,
      notes: input.notes,
      performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
      performedById: ctx.actorId,
    },
  });

  const fresh = await fetchMovementWithRefs(tx, created.id);
  const dto = toMovementDTO(fresh);
  await recordMutation(ctx, {
    entity: 'stock_movement',
    entityId: created.id,
    action: 'INSERT',
    after: dto,
  });
  return dto;
}
