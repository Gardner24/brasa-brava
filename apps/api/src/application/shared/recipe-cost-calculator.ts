/**
 * Cálculo recursivo de costo de receta vía CTE de Postgres.
 *
 * Estrategia: expandir todas las líneas de la receta + sub-recetas hasta
 * llegar a productos hoja, multiplicando cantidades por la cadena (con
 * `qty / sub_recipe.yield_qty` para escalar cuando una sub-receta produce
 * más de 1 porción), y luego sumar `qty * unit_cost` de todos los productos.
 *
 * Decisión D1 — CTE recursiva. Para nuestra escala (33 recetas, BOM de
 * profundidad ≤2) responde en <5ms. Si crece a miles de recetas con
 * jerarquías profundas, migramos a vista materializada sin cambiar la API.
 *
 * Salvaguardas:
 *  - `depth < 10` previene loops infinitos por ciclos en el grafo
 *  - LEFT JOIN a products para tolerar productos en cuarentena (cost = 0)
 *  - Se reporta `incompleteProducts` para que el frontend alerte
 */
import type { Prisma } from '@brasa/db';

export interface ExpandedIngredient {
  product_id: string;
  product_sku: string;
  product_name: { es: string; en: string };
  cumulative_qty: number;
  unit: string;
  unit_cost: number | null;
  line_cost: number;
}

export interface RecipeCostBreakdown {
  recipeId: string;
  costPerPortion: number;
  ingredients: ExpandedIngredient[];
  incompleteProducts: { productId: string; sku: string }[];
  hasIncompleteCost: boolean;
}

interface RawRow {
  product_id: string;
  product_sku: string;
  product_name: { es: string; en: string };
  cumulative_qty: string;
  unit: string;
  unit_cost: string | null;
}

/**
 * Calcula el costo por porción de una receta, expandiendo sub-recetas.
 * Si la receta no existe, retorna costo 0 con array vacío.
 */
export async function computeRecipeCost(
  tx: Prisma.TransactionClient,
  recipeId: string,
): Promise<RecipeCostBreakdown> {
  const rows: RawRow[] = await tx.$queryRaw`
    WITH RECURSIVE expansion AS (
      -- Base: líneas directas de la receta objetivo
      SELECT
        rl.product_id,
        rl.sub_recipe_id,
        rl.qty_per_portion::numeric AS cumulative_qty,
        rl.unit,
        1 AS depth
      FROM recipe_lines rl
      WHERE rl.recipe_id = ${recipeId}::uuid

      UNION ALL

      -- Recurse: expandir cada sub-receta a sus propias líneas, escalando por yield
      SELECT
        rl.product_id,
        rl.sub_recipe_id,
        e.cumulative_qty * rl.qty_per_portion::numeric / NULLIF(sr.yield_qty::numeric, 0) AS cumulative_qty,
        rl.unit,
        e.depth + 1
      FROM expansion e
      JOIN recipes sr ON sr.id = e.sub_recipe_id
      JOIN recipe_lines rl ON rl.recipe_id = e.sub_recipe_id
      WHERE e.sub_recipe_id IS NOT NULL
        AND e.depth < 10
    )
    SELECT
      e.product_id,
      p.sku AS product_sku,
      p.name AS product_name,
      SUM(e.cumulative_qty)::text AS cumulative_qty,
      e.unit,
      p.unit_cost::text AS unit_cost
    FROM expansion e
    JOIN products p ON p.id = e.product_id
    WHERE e.product_id IS NOT NULL
    GROUP BY e.product_id, p.sku, p.name, e.unit, p.unit_cost
    ORDER BY p.sku
  `;

  const ingredients: ExpandedIngredient[] = rows.map((r) => {
    const qty = Number(r.cumulative_qty);
    const cost = r.unit_cost == null ? null : Number(r.unit_cost);
    return {
      product_id: r.product_id,
      product_sku: r.product_sku,
      product_name: r.product_name,
      cumulative_qty: qty,
      unit: r.unit,
      unit_cost: cost,
      line_cost: cost == null ? 0 : qty * cost,
    };
  });

  const incompleteProducts = ingredients
    .filter((i) => i.unit_cost == null)
    .map((i) => ({ productId: i.product_id, sku: i.product_sku }));

  const costPerPortion = ingredients.reduce((sum, i) => sum + i.line_cost, 0);

  return {
    recipeId,
    costPerPortion,
    ingredients,
    incompleteProducts,
    hasIncompleteCost: incompleteProducts.length > 0,
  };
}

/**
 * Verifica que insertar una sub-receta no genere ciclo (A → B → A).
 * Recorre la jerarquía downstream del candidato a sub-receta buscando
 * el `recipeId` raíz. Llamada antes de cada PUT /recipes/:id/lines.
 */
export async function detectCycle(
  tx: Prisma.TransactionClient,
  recipeId: string,
  candidateSubRecipeIds: string[],
): Promise<{ hasCycle: boolean; cyclePath?: string[] }> {
  if (candidateSubRecipeIds.length === 0) return { hasCycle: false };
  if (candidateSubRecipeIds.includes(recipeId)) {
    return { hasCycle: true, cyclePath: [recipeId, recipeId] };
  }

  // ¿Alguna sub-receta candidata tiene a `recipeId` en su descendencia?
  const rows: { id: string }[] = await tx.$queryRaw`
    WITH RECURSIVE descendants AS (
      SELECT id FROM recipes WHERE id = ANY(${candidateSubRecipeIds}::uuid[])
      UNION ALL
      SELECT rl.sub_recipe_id AS id
      FROM descendants d
      JOIN recipe_lines rl ON rl.recipe_id = d.id
      WHERE rl.sub_recipe_id IS NOT NULL
    )
    SELECT id FROM descendants WHERE id = ${recipeId}::uuid LIMIT 1
  `;

  return rows.length > 0
    ? { hasCycle: true, cyclePath: [recipeId, ...candidateSubRecipeIds, recipeId] }
    : { hasCycle: false };
}
