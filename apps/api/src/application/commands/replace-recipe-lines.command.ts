/**
 * Reemplazo atómico de las líneas de una receta.
 *
 * Filosofía:
 *  - El editor split-pane envía la lista completa al guardar (más simple
 *    que add/remove individual; el cliente mantiene el estado local).
 *  - Optimistic locking sobre la receta padre: si version cambia entre
 *    cargar el editor y guardar → 409 RECIPE_VERSION_CONFLICT.
 *  - Validación de cada línea: producto debe existir activo, sub-receta
 *    debe existir y NO crear ciclo (A → B → A).
 *  - Operación atómica: o se aplican todas las líneas o ninguna.
 */
import { Prisma } from '@brasa/db';
import type { ReplaceRecipeLinesRequest, RecipeDetailDTO } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';
import { detectCycle } from '../shared/recipe-cost-calculator.js';
import { getRecipeDetail } from '../queries/get-recipe-detail.query.js';

export async function replaceRecipeLines(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  recipeId: string,
  input: ReplaceRecipeLinesRequest,
): Promise<RecipeDetailDTO> {
  const recipe = await tx.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) throw new DomainError('NOT_FOUND', 404);
  if (recipe.version !== input.expectedVersion) {
    throw new DomainError('RECIPE_VERSION_CONFLICT', 409, {
      expectedVersion: input.expectedVersion,
      currentVersion: recipe.version,
    });
  }

  // Validación de líneas
  const productIds = input.lines.map((l) => l.productId).filter((x): x is string => Boolean(x));
  const subRecipeIds = input.lines.map((l) => l.subRecipeId).filter((x): x is string => Boolean(x));

  if (productIds.length) {
    const found = await tx.product.count({
      where: { id: { in: productIds }, tenantId: ctx.tenantId },
    });
    if (found !== new Set(productIds).size) {
      throw new DomainError('RECIPE_PRODUCT_NOT_FOUND', 404, { ids: productIds });
    }
  }
  if (subRecipeIds.length) {
    const found = await tx.recipe.count({
      where: { id: { in: subRecipeIds }, tenantId: ctx.tenantId },
    });
    if (found !== new Set(subRecipeIds).size) {
      throw new DomainError('RECIPE_SUBRECIPE_NOT_FOUND', 404, { ids: subRecipeIds });
    }

    const cycle = await detectCycle(tx, recipeId, [...new Set(subRecipeIds)]);
    if (cycle.hasCycle) {
      throw new DomainError('RECIPE_CYCLE_DETECTED', 400, { cyclePath: cycle.cyclePath });
    }
  }

  // Snapshot before
  const before = await getRecipeDetail(tx, recipeId);

  // Reemplazo atómico
  await tx.recipeLine.deleteMany({ where: { recipeId } });

  if (input.lines.length > 0) {
    await tx.recipeLine.createMany({
      data: input.lines.map((l) => ({
        recipeId,
        productId: l.productId ?? null,
        subRecipeId: l.subRecipeId ?? null,
        qtyPerPortion: l.qtyPerPortion,
        unit: l.unit,
        notes: l.notes ?? null,
        position: l.position,
      })),
    });
  }

  // Bump version de la receta para que próximos editores vean conflict
  const versionBump = await tx.recipe.updateMany({
    where: { id: recipeId, version: input.expectedVersion },
    data: { version: { increment: 1 } },
  });
  if (versionBump.count === 0) {
    // Race condition entre nuestro check y el delete. Postgres ya aplicó
    // los cambios a las líneas pero la receta cambió de version mientras
    // tanto. La transacción se rollback al lanzar.
    throw new DomainError('RECIPE_VERSION_CONFLICT', 409);
  }

  const after = await getRecipeDetail(tx, recipeId);

  await recordMutation(ctx, {
    entity: 'recipe_lines',
    entityId: recipeId,
    action: 'UPDATE',
    before: { lines: before.lines, costPerPortion: before.costPerPortion },
    after: { lines: after.lines, costPerPortion: after.costPerPortion },
  });

  return after;
}
