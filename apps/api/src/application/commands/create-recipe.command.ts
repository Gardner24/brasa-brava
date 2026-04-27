/**
 * Crear receta vacía. Las líneas se agregan después con PUT /recipes/:id/lines.
 */
import { Prisma } from '@brasa/db';
import type { CreateRecipeRequest, RecipeDTO } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';
import { toRecipeDTO } from '../shared/recipe-mapper.js';

export async function createRecipe(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  input: CreateRecipeRequest,
): Promise<RecipeDTO> {
  try {
    const recipe = await tx.recipe.create({
      data: {
        tenantId: ctx.tenantId,
        code: input.code,
        name: input.name as unknown as Prisma.InputJsonValue,
        yieldQty: input.yieldQty,
        yieldUnit: input.yieldUnit,
        instructions: input.instructions ?? null,
        cookingTemp: input.cookingTemp ?? null,
        cookingTime: input.cookingTime ?? null,
      },
    });

    const dto = toRecipeDTO(recipe, 0);
    await recordMutation(ctx, {
      entity: 'recipe',
      entityId: recipe.id,
      action: 'INSERT',
      after: dto,
    });
    return dto;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new DomainError('RECIPE_CODE_TAKEN', 409, { code: input.code });
    }
    throw err;
  }
}
