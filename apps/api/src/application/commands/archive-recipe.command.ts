/**
 * Archivar receta (soft delete vía isActive=false).
 * Bloquea si la receta está siendo usada como sub-receta de otra activa,
 * salvo que se pase ?force=true.
 */
import type { Prisma } from '@brasa/db';
import type { RecipeDTO } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';
import { toRecipeDTO } from '../shared/recipe-mapper.js';

export interface ArchiveRecipeInput {
  expectedVersion: number;
  force?: boolean;
}

export async function archiveRecipe(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  recipeId: string,
  input: ArchiveRecipeInput,
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
  if (!current.isActive) return toRecipeDTO(current);

  if (!input.force) {
    const usedAsSubInActive = await tx.recipeLine.count({
      where: { subRecipeId: recipeId, recipe: { isActive: true } },
    });
    if (usedAsSubInActive > 0) {
      throw new DomainError('RECIPE_HAS_DEPENDENCIES', 409, { usedAsSubInActive });
    }
  }

  const result = await tx.recipe.updateMany({
    where: { id: recipeId, version: input.expectedVersion },
    data: { isActive: false, version: { increment: 1 } },
  });
  if (result.count === 0) throw new DomainError('RECIPE_VERSION_CONFLICT', 409);

  const fresh = await tx.recipe.findUniqueOrThrow({
    where: { id: recipeId },
    include: { _count: { select: { lines: true } } },
  });
  const after = toRecipeDTO(fresh);
  const before = toRecipeDTO(current);

  await recordMutation(ctx, {
    entity: 'recipe',
    entityId: recipeId,
    action: 'DELETE',
    before,
    after,
  });
  return after;
}
