import type { Prisma, Recipe, RecipeLine, Product } from '@brasa/db';
import type { RecipeDTO, RecipeLineDTO } from '@brasa/shared-types';

type RecipeWithCount = Recipe & { _count?: { lines: number } };

export function toRecipeDTO(r: RecipeWithCount, linesCount?: number): RecipeDTO {
  return {
    id: r.id,
    code: r.code,
    name: r.name as { es: string; en: string },
    yieldQty: Number(r.yieldQty),
    yieldUnit: r.yieldUnit as 'porcion' | 'g' | 'ml' | 'unit',
    cookingTemp: r.cookingTemp,
    cookingTime: r.cookingTime,
    isActive: r.isActive,
    version: r.version,
    linesCount: linesCount ?? r._count?.lines ?? 0,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

type LineWithRefs = RecipeLine & {
  product: (Pick<Product, 'name' | 'sku' | 'unitCost'>) | null;
  subRecipe: (Pick<Recipe, 'name' | 'code'>) | null;
};

export function toRecipeLineDTO(l: LineWithRefs): RecipeLineDTO {
  const qty = Number(l.qtyPerPortion);
  const unitCost = l.product?.unitCost == null ? null : Number(l.product.unitCost);
  return {
    id: l.id,
    productId: l.productId,
    subRecipeId: l.subRecipeId,
    productName: (l.product?.name as { es: string; en: string }) ?? null,
    productSku: l.product?.sku ?? null,
    productUnitCost: unitCost,
    subRecipeName: (l.subRecipe?.name as { es: string; en: string }) ?? null,
    subRecipeCode: l.subRecipe?.code ?? null,
    qtyPerPortion: qty,
    unit: l.unit as 'g' | 'ml' | 'unit' | 'porcion',
    notes: l.notes,
    position: l.position,
    // Costo de línea: solo aplicable a líneas-producto (las sub-recetas se
    // calculan recursivamente en el endpoint con costPerPortion total)
    lineCostPerPortion: unitCost == null ? 0 : qty * unitCost,
  };
}
