/**
 * Editar metadata de receta (no líneas). Optimistic concurrency.
 */
import { Prisma } from '@brasa/db';
import type { UpdateRecipeRequest, RecipeDTO } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';
import { toRecipeDTO } from '../shared/recipe-mapper.js';

export async function updateRecipe(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  recipeId: string,
  input: UpdateRecipeRequest,
): Promise<RecipeDTO> {
  const current = await tx.recipe.findUnique({
    where: { id: recipeId },
    include: { _count: { select: { lines: true } } },
  });
  if (!current) throw new DomainError('NOT_FOUND', 404);
  if (current.version !== input.expectedVersion) {
    throw new DomainError('RECIPE_VERSION_CONFLICT', 409, {
      expectedVersion: input.expectedVersion,
      currentVersion: current.version,
    });
  }

  const result = await tx.recipe.updateMany({
    where: { id: recipeId, version: input.expectedVersion },
    data: {
      ...(input.name !== undefined ? { name: input.name as unknown as Prisma.InputJsonValue } : {}),
      ...(input.yieldQty !== undefined ? { yieldQty: input.yieldQty } : {}),
      ...(input.yieldUnit !== undefined ? { yieldUnit: input.yieldUnit } : {}),
      ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
      ...(input.cookingTemp !== undefined ? { cookingTemp: input.cookingTemp } : {}),
      ...(input.cookingTime !== undefined ? { cookingTime: input.cookingTime } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      version: { increment: 1 },
    },
  });
  if (result.count === 0) {
    throw new DomainError('RECIPE_VERSION_CONFLICT', 409);
  }

  const fresh = await tx.recipe.findUniqueOrThrow({
    where: { id: recipeId },
    include: { _count: { select: { lines: true } } },
  });
  const after = toRecipeDTO(fresh);
  const before = toRecipeDTO(current);

  await recordMutation(ctx, {
    entity: 'recipe',
    entityId: recipeId,
    action: 'UPDATE',
    before,
    after,
  });
  return after;
}
