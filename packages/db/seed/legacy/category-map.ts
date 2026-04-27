/**
 * SOURCE OF TRUTH del mapping legacy (Excel) → canónico (DB).
 * Cualquier cambio entra por PR contra este archivo y re-corrida del seed.
 * Decisión documentada en `01_DECISION_CATEGORIAS_v1.0.md` (ADR-001).
 */

export type CanonicalCategoryCode =
  | 'CARNES'
  | 'ESPECIAS'
  | 'FRUTAS_VERDURAS'
  | 'SALSAS'
  | 'ACEITES_GRASAS'
  | 'LACTEOS'
  | 'ABARROTES'
  | 'BEBIDAS'
  | 'PREPARADOS';

export interface CanonicalCategory {
  code: CanonicalCategoryCode;
  displayName: { es: string; en: string };
  description: string;
}

export const CANONICAL_CATEGORIES: readonly CanonicalCategory[] = [
  {
    code: 'CARNES',
    displayName: { es: 'Carnes y Embutidos', en: 'Meat & Cured Meat' },
    description: 'Carnes frescas, embutidos y proteínas cárnicas.',
  },
  {
    code: 'ESPECIAS',
    displayName: { es: 'Especias y Condimentos', en: 'Spices & Seasonings' },
    description: 'Especias secas, hierbas, sales y condimentos.',
  },
  {
    code: 'FRUTAS_VERDURAS',
    displayName: { es: 'Frutas y Verduras', en: 'Produce' },
    description: 'Productos frescos vegetales perecederos.',
  },
  {
    code: 'SALSAS',
    displayName: { es: 'Salsas, Aderezos y Vinagres', en: 'Sauces, Dressings & Vinegars' },
    description: 'Salsas, aderezos, mostazas, mayonesas y vinagres.',
  },
  {
    code: 'ACEITES_GRASAS',
    displayName: { es: 'Aceites y Grasas', en: 'Oils & Fats' },
    description: 'Aceites de cocina, mantequillas y grasas.',
  },
  {
    code: 'LACTEOS',
    displayName: { es: 'Lácteos', en: 'Dairy' },
    description: 'Productos lácteos, quesos y huevos (cadena de frío).',
  },
  {
    code: 'ABARROTES',
    displayName: { es: 'Abarrotes y Endulzantes', en: 'Pantry & Sweeteners' },
    description: 'Despensa seca: azúcares, harinas, granos.',
  },
  {
    code: 'BEBIDAS',
    displayName: { es: 'Bebidas', en: 'Beverages' },
    description: 'Bebidas usadas como ingrediente.',
  },
  {
    code: 'PREPARADOS',
    displayName: { es: 'Preparados Listos para Servir', en: 'Ready-to-Serve' },
    description: 'Productos terminados de compra (no in-house).',
  },
] as const;

export const LEGACY_CATEGORY_MAP: Record<string, CanonicalCategoryCode | null> = {
  Carnes: 'CARNES',
  'Carnes / Embutidos': 'CARNES',
  'Especias / Condimentos': 'ESPECIAS',
  'Frutas / Verduras': 'FRUTAS_VERDURAS',
  'Salsas / Aderezos': 'SALSAS',
  'Salsas / Condimentos': 'SALSAS',
  'Aceites / Grasas': 'ACEITES_GRASAS',
  'Lácteos / Proteínas': 'LACTEOS',
  'Lácteos / Quesos': 'LACTEOS',
  'Abarrotes / Endulzantes': 'ABARROTES',
  'Abarrotes / Legumbres': null, // disuelto: items reclasificados en PRODUCT_OVERRIDES
  Bebidas: 'BEBIDAS',
  'Preparados / Listos para servir': 'PREPARADOS',
  'Sub Recetas': null, // disuelto: items promovidos a `recipe`
};

export const PRODUCT_OVERRIDES: Record<string, CanonicalCategoryCode> = {
  Apio: 'FRUTAS_VERDURAS',
  'Repollo Blanco': 'FRUTAS_VERDURAS',
  Zanahoria: 'FRUTAS_VERDURAS',
};

export const SUBRECIPE_PROMOTIONS: Array<{
  productName: string;
  recipeSheetName: string;
}> = [
  { productName: 'Pepinillos (encurtido picados)', recipeSheetName: 'Pepinillos Encurtidos' },
];

export function resolveCanonicalCategory(
  productName: string,
  legacyCategory: string | null | undefined,
): CanonicalCategoryCode | null {
  const trimmed = (productName ?? '').trim();
  if (trimmed in PRODUCT_OVERRIDES) return PRODUCT_OVERRIDES[trimmed]!;

  if (legacyCategory == null) {
    throw new Error(`Product "${trimmed}" has no legacy category`);
  }
  if (!(legacyCategory in LEGACY_CATEGORY_MAP)) {
    throw new Error(`Unmapped legacy category "${legacyCategory}" for product "${trimmed}"`);
  }
  return LEGACY_CATEGORY_MAP[legacyCategory] ?? null;
}
