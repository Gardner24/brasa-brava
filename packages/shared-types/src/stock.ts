import { z } from 'zod';
import { Bilingual, UUID } from './common.js';

/**
 * Boolean en query string. NO usar z.coerce.boolean() porque convierte
 * "false" en true (Boolean("false") === true). Este preprocesa los strings
 * literales "true" / "false" antes de validar.
 */
const QueryBoolean = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean(),
);

export const MovementType = z.enum([
  'PURCHASE',
  'CONSUMPTION',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT',
  'WASTE',
  'RETURN',
  'INITIAL',
]);
export type MovementType = z.infer<typeof MovementType>;

export const WasteReason = z.enum([
  'EXPIRED',
  'SPOILED',
  'DAMAGED',
  'PREP_LOSS',
  'CUSTOMER_RETURN',
  'OTHER',
]);
export type WasteReason = z.infer<typeof WasteReason>;

// =================== Movement DTOs ===================

export const StockMovementDTO = z.object({
  id: UUID,
  productId: UUID,
  productSku: z.string(),
  productName: Bilingual,
  warehouseId: UUID,
  warehouseCode: z.string(),
  movementType: MovementType,
  qty: z.number(),
  unitCost: z.number().nullable(),
  totalValue: z.number(), // qty × unitCost (informativo)
  wasteReason: WasteReason.nullable(),
  referenceType: z.string().nullable(),
  referenceId: UUID.nullable(),
  pairedMovementId: UUID.nullable(),
  notes: z.string().nullable(),
  performedAt: z.string().datetime(),
  performedById: UUID,
});
export type StockMovementDTO = z.infer<typeof StockMovementDTO>;

// =================== Movement requests ===================

export const PurchaseMovementRequest = z.object({
  productId: UUID,
  warehouseId: UUID,
  qty: z.number().positive(),
  unitCost: z.number().nonnegative(), // costo de la compra (puede ser distinto al avg)
  notes: z.string().max(500).optional(),
  performedAt: z.string().datetime().optional(),
});
export type PurchaseMovementRequest = z.infer<typeof PurchaseMovementRequest>;

export const ConsumptionMovementRequest = z.object({
  productId: UUID,
  warehouseId: UUID,
  qty: z.number().positive(), // se almacena como negativo en el ledger
  notes: z.string().max(500).optional(),
  referenceType: z.string().max(40).optional(),
  referenceId: UUID.optional(),
  performedAt: z.string().datetime().optional(),
});
export type ConsumptionMovementRequest = z.infer<typeof ConsumptionMovementRequest>;

export const WasteMovementRequest = z.object({
  productId: UUID,
  warehouseId: UUID,
  qty: z.number().positive(),
  wasteReason: WasteReason,
  notes: z.string().max(500).optional(),
  performedAt: z.string().datetime().optional(),
});
export type WasteMovementRequest = z.infer<typeof WasteMovementRequest>;

export const TransferMovementRequest = z.object({
  productId: UUID,
  fromWarehouseId: UUID,
  toWarehouseId: UUID,
  qty: z.number().positive(),
  notes: z.string().max(500).optional(),
  performedAt: z.string().datetime().optional(),
});
export type TransferMovementRequest = z.infer<typeof TransferMovementRequest>;

export const AdjustmentMovementRequest = z.object({
  productId: UUID,
  warehouseId: UUID,
  qty: z.number(), // signo libre: positivo = sumar, negativo = restar
  notes: z.string().min(5).max(500), // obligatorio justificar ajustes manuales
  performedAt: z.string().datetime().optional(),
});
export type AdjustmentMovementRequest = z.infer<typeof AdjustmentMovementRequest>;

// =================== Listado de movimientos ===================

export const ListMovementsQuery = z.object({
  warehouseId: UUID.optional(),
  productId: UUID.optional(),
  movementType: MovementType.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListMovementsQuery = z.infer<typeof ListMovementsQuery>;

// =================== Stock query ===================

export const StockLevelDTO = z.object({
  productId: UUID,
  productSku: z.string(),
  productName: Bilingual,
  categoryCode: z.string(),
  baseUnit: z.string(),
  qtyOnHand: z.number(),
  avgUnitCost: z.number().nullable(),
  totalValue: z.number(),
  reorderPoint: z.number().nullable(),
  isBelowReorder: z.boolean(),
  isNegative: z.boolean(),
  // Días estimados de cobertura (qtyOnHand / avg_daily_consumption). Null si no hay consumo histórico.
  daysCoverage: z.number().nullable(),
  lastConsumptionAt: z.string().datetime().nullable(),
});
export type StockLevelDTO = z.infer<typeof StockLevelDTO>;

export const ListStockQuery = z.object({
  warehouseId: UUID,
  categoryCode: z.string().optional(),
  belowReorderOnly: QueryBoolean.optional(),
  negativeOnly: QueryBoolean.optional(),
});
export type ListStockQuery = z.infer<typeof ListStockQuery>;

export const StockValuationByCategoryDTO = z.object({
  warehouseId: UUID,
  totals: z.array(
    z.object({
      categoryCode: z.string(),
      itemsCount: z.number().int(),
      totalValueCRC: z.number(),
    }),
  ),
  grandTotalCRC: z.number(),
});
export type StockValuationByCategoryDTO = z.infer<typeof StockValuationByCategoryDTO>;

// =================== Alerts ===================

export const LowStockAlertDTO = z.object({
  id: UUID,
  productId: UUID,
  productSku: z.string(),
  productName: Bilingual,
  warehouseId: UUID,
  warehouseCode: z.string(),
  // Snapshot al momento de raise + valores frescos para comparar
  qtyOnHandAtRaise: z.number(),
  qtyOnHandNow: z.number(),
  reorderPoint: z.number(),
  raisedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  resolvedById: UUID.nullable(),
});
export type LowStockAlertDTO = z.infer<typeof LowStockAlertDTO>;

export const ListAlertsQuery = z.object({
  warehouseId: UUID.optional(),
  resolved: QueryBoolean.optional(), // default: solo no-resueltas
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListAlertsQuery = z.infer<typeof ListAlertsQuery>;

export const ResolveAlertRequest = z.object({
  notes: z.string().max(500).optional(),
});
export type ResolveAlertRequest = z.infer<typeof ResolveAlertRequest>;
