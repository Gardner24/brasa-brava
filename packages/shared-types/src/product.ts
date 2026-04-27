import { z } from 'zod';
import { Bilingual, UUID } from './common.js';

export const BaseUnit = z.enum(['g', 'ml', 'unit']);
export type BaseUnit = z.infer<typeof BaseUnit>;

export const DataQualityIssue = z.enum([
  'MISSING_COST',
  'MISSING_PACKAGE_SIZE',
  'AMBIGUOUS_UNIT',
]);
export type DataQualityIssue = z.infer<typeof DataQualityIssue>;

export const ProductDTO = z.object({
  id: UUID,
  sku: z.string().min(1).max(40),
  name: Bilingual,
  categoryId: UUID,
  categoryCode: z.string(),
  baseUnit: BaseUnit,
  packageSize: z.number().nullable(),
  packageCost: z.number().nullable(),
  unitCost: z.number().nullable(),
  reorderPoint: z.number().nullable(),
  reorderQty: z.number().nullable(),
  isActive: z.boolean(),
  dataQualityIssue: DataQualityIssue.nullable(),
  notes: z.string().nullable(),
  version: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProductDTO = z.infer<typeof ProductDTO>;

export const ProductDetailDTO = ProductDTO.extend({
  aliases: z.array(z.object({ id: UUID, alias: z.string() })),
  priceHistory: z.array(
    z.object({
      id: UUID,
      packageCost: z.number(),
      packageSize: z.number(),
      unitCost: z.number(),
      effectiveAt: z.string().datetime(),
      source: z.string(),
      createdById: UUID,
    }),
  ),
  usedInRecipesCount: z.number().int().nonnegative(),
});
export type ProductDetailDTO = z.infer<typeof ProductDetailDTO>;

export const CreateProductRequest = z.object({
  sku: z.string().min(1).max(40).regex(/^[A-Z0-9_-]+$/, 'SKU must be UPPERCASE letters, digits, _ or -'),
  name: Bilingual,
  categoryCode: z.string().min(1),
  baseUnit: BaseUnit,
  packageSize: z.number().positive().optional(),
  packageCost: z.number().nonnegative().optional(),
  reorderPoint: z.number().nonnegative().optional(),
  reorderQty: z.number().positive().optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateProductRequest = z.infer<typeof CreateProductRequest>;

export const UpdateProductRequest = z.object({
  name: Bilingual.optional(),
  categoryCode: z.string().min(1).optional(),
  baseUnit: BaseUnit.optional(),
  packageSize: z.number().positive().nullable().optional(),
  packageCost: z.number().nonnegative().nullable().optional(),
  reorderPoint: z.number().nonnegative().nullable().optional(),
  reorderQty: z.number().positive().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  // Optimistic concurrency: el cliente envía la version que tenía al cargar el form.
  expectedVersion: z.number().int().nonnegative(),
});
export type UpdateProductRequest = z.infer<typeof UpdateProductRequest>;

export const ListProductsQuery = z.object({
  search: z.string().optional(),
  categoryCode: z.string().optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  dataQualityIssue: DataQualityIssue.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListProductsQuery = z.infer<typeof ListProductsQuery>;

export const PaginatedProducts = z.object({
  data: z.array(ProductDTO),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});
export type PaginatedProducts = z.infer<typeof PaginatedProducts>;

// ===== Aliases =====
export const AliasDTO = z.object({
  id: UUID,
  productId: UUID,
  alias: z.string(),
  createdAt: z.string().datetime(),
});
export type AliasDTO = z.infer<typeof AliasDTO>;

export const AddAliasRequest = z.object({
  alias: z.string().min(1).max(120),
});
export type AddAliasRequest = z.infer<typeof AddAliasRequest>;

// ===== Price history =====
export const PriceHistoryEntryDTO = z.object({
  id: UUID,
  productId: UUID,
  packageCost: z.number(),
  packageSize: z.number(),
  unitCost: z.number(),
  effectiveAt: z.string().datetime(),
  source: z.string(),
  createdById: UUID,
});
export type PriceHistoryEntryDTO = z.infer<typeof PriceHistoryEntryDTO>;

export const ListPriceHistoryQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListPriceHistoryQuery = z.infer<typeof ListPriceHistoryQuery>;
