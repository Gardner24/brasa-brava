/**
 * Query: detalle completo de una receta.
 * Incluye:
 *  - Metadata + líneas con productos/sub-recetas resueltos
 *  - Costo por porción calculado vía CTE recursiva (D1)
 *  - Costo total para yieldQty
 *  - Lista de productos con costo faltante (para warning en UI)
 */
import type { Prisma } from '@brasa/db';
import type { RecipeDetailDTO } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { toRecipeDTO, toRecipeLineDTO } from '../shared/recipe-mapper.js';
import { computeRecipeCost } from '../shared/recipe-cost-calculator.js';

export async function getRecipeDetail(
  tx: Prisma.TransactionClient,
  recipeId: string,
): Promise<RecipeDetailDTO> {
  const recipe = await tx.recipe.findUnique({
    where: { id: recipeId },
    include: {
      _count: { select: { lines: true } },
      lines: {
        orderBy: { position: 'asc' },
        include: {
          product: { select: { name: true, sku: true, unitCost: true } },
          subRecipe: { select: { name: true, code: true } },
        },
      },
    },
  });
  if (!recipe) throw new DomainError('NOT_FOUND', 404);

  const cost = await computeRecipeCost(tx, recipeId);
  const base = toRecipeDTO(recipe);

  return {
    ...base,
    instructions: recipe.instructions,
    lines: recipe.lines.map((l) => toRecipeLineDTO(l)),
    costPerPortion: roundCRC(cost.costPerPortion),
    costForYield: roundCRC(cost.costPerPortion * Number(recipe.yieldQty)),
    hasIncompleteCost: cost.hasIncompleteCost,
    incompleteProducts: cost.incompleteProducts,
  };
}

function roundCRC(n: number): number {
  return Math.round(n * 100) / 100;
}
