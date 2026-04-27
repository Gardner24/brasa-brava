/**
 * "Simulador para N comensales" — réplica del Home!B14 del Excel.
 * Devuelve la lista expandida de ingredientes (con cantidades multiplicadas
 * por guestCount) y el costo total agregado.
 */
import type { Prisma } from '@brasa/db';
import type { ScaleRecipeRequest, ScaledRecipeDTO } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { computeRecipeCost } from '../shared/recipe-cost-calculator.js';

export async function scaleRecipe(
  tx: Prisma.TransactionClient,
  recipeId: string,
  input: ScaleRecipeRequest,
): Promise<ScaledRecipeDTO> {
  const recipe = await tx.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) throw new DomainError('NOT_FOUND', 404);

  const cost = await computeRecipeCost(tx, recipeId);
  const guests = input.guestCount;

  return {
    recipeId,
    guestCount: guests,
    costPerPortion: round(cost.costPerPortion),
    totalCost: round(cost.costPerPortion * guests),
    ingredients: cost.ingredients.map((i) => ({
      productId: i.product_id,
      sku: i.product_sku,
      name: i.product_name,
      cumulativeQty: round4(i.cumulative_qty * guests),
      unit: i.unit,
      unitCost: round4(i.unit_cost ?? 0),
      lineCost: round(i.line_cost * guests),
    })),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
