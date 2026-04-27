/**
 * Mapper único Product (Prisma) → ProductDTO (shared-types).
 * Centralizado para evitar drift entre endpoints.
 */
import type { Product, ProductCategory } from '@brasa/db';
import type { ProductDTO } from '@brasa/shared-types';

type ProductWithCategory = Product & { category: Pick<ProductCategory, 'code'> };

export function toProductDTO(p: ProductWithCategory): ProductDTO {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name as { es: string; en: string },
    categoryId: p.categoryId,
    categoryCode: p.category.code,
    baseUnit: p.baseUnit as 'g' | 'ml' | 'unit',
    packageSize: p.packageSize == null ? null : Number(p.packageSize),
    packageCost: p.packageCost == null ? null : Number(p.packageCost),
    unitCost: p.unitCost == null ? null : Number(p.unitCost),
    reorderPoint: p.reorderPoint == null ? null : Number(p.reorderPoint),
    reorderQty: p.reorderQty == null ? null : Number(p.reorderQty),
    isActive: p.isActive,
    dataQualityIssue: p.dataQualityIssue,
    notes: p.notes,
    version: p.version,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
