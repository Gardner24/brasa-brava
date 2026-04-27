/**
 * Seed reproducible para Brasa Brava.
 *
 * Idempotente: puede correr N veces sin duplicar.
 * Estrategia: upsert por clave de negocio (`code`, `sku`, `email`...).
 *
 * Salida: `packages/db/seed/reports/migration-report-<ISO>.json` con métricas
 * de la corrida (productos importados, en cuarentena, categorías colapsadas, etc.).
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  CANONICAL_CATEGORIES,
  PRODUCT_OVERRIDES,
  SUBRECIPE_PROMOTIONS,
  resolveCanonicalCategory,
} from './legacy/category-map.js';
import { readWorkbook, type LegacyIngredient } from './excel-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

interface MigrationReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  excelPath: string;
  tenant: { code: string; id: string };
  rolesCreated: number;
  adminUser: { email: string; id: string };
  warehousesCreated: number;
  menusCreated: number;
  categories: { canonical: number; legacyMapped: number };
  products: {
    imported: number;
    quarantined: { sku: string; name: string; reason: string }[];
    promotedToRecipes: { name: string; recipeCode: string }[];
  };
  recipes: { imported: number; lines: number; subRecipeRefs: number };
  warnings: string[];
}

const PERMISSIONS = {
  ADMIN: ['*'],
  AUDITOR: [
    'product.read',
    'recipe.read',
    'category.read',
    'inventory.read',
    'audit.read',
    'audit.create',
    'audit.run',
    'audit.reconcile',
    'audit_log.read',
    'report.read',
    'report.export',
  ],
  OPERATOR: [
    'product.read',
    'recipe.read',
    'category.read',
    'warehouse.read',
    'inventory.read',
    'inventory.move',
    'audit.read',
    'audit.run',
  ],
  VIEWER: [
    'product.read',
    'recipe.read',
    'category.read',
    'inventory.read',
    'audit.read',
    'report.read',
  ],
};

const ROLES = [
  { code: 'ADMIN', displayName: 'Administrador' },
  { code: 'AUDITOR', displayName: 'Auditor' },
  { code: 'OPERATOR', displayName: 'Operador' },
  { code: 'VIEWER', displayName: 'Solo lectura' },
] as const;

const DEFAULT_WAREHOUSES = [
  { code: 'COCINA', displayName: 'Cocina principal' },
  { code: 'CAMARA', displayName: 'Cámara fría' },
  { code: 'EVENTOS', displayName: 'Bodega de eventos' },
] as const;

const MENUS = [
  { code: 'AMERICANA', name: { es: 'Americana', en: 'American' } },
  { code: 'ARGENTINA', name: { es: 'Argentina', en: 'Argentinean' } },
  { code: 'TICA', name: { es: 'Tica', en: 'Costa Rican' } },
] as const;

function slug(s: string, max = 36): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max);
}

/** Trunca strings a un máximo seguro para columnas varchar. */
function truncate(s: string | null | undefined, max: number): string | null {
  if (s == null) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function bilingual(es: string): Prisma.JsonObject {
  // Por defecto, EN se inicializa igual a ES; el Admin puede traducir luego.
  return { es, en: es };
}

async function seedTenant(): Promise<{ id: string; code: string }> {
  const code = process.env.SEED_TENANT_CODE ?? 'BRASA_BRAVA';
  const displayName = process.env.SEED_TENANT_NAME ?? 'Brasa Brava';
  const tenant = await prisma.tenant.upsert({
    where: { code },
    update: { displayName },
    create: { code, displayName },
  });
  return { id: tenant.id, code: tenant.code };
}

async function seedRoles(): Promise<number> {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { displayName: role.displayName, permissions: PERMISSIONS[role.code] },
      create: { code: role.code, displayName: role.displayName, permissions: PERMISSIONS[role.code] },
    });
  }
  return ROLES.length;
}

async function seedAdmin(tenantId: string): Promise<{ email: string; id: string }> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@brasabrava.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMeOnFirstLogin!';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isActive: true, tenantId, fullName: 'Administrador' },
    create: { email, passwordHash, isActive: true, tenantId, fullName: 'Administrador' },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });
  return { email: user.email, id: user.id };
}

async function seedWarehouses(tenantId: string): Promise<number> {
  for (const w of DEFAULT_WAREHOUSES) {
    await prisma.warehouse.upsert({
      where: { tenantId_code: { tenantId, code: w.code } },
      update: { displayName: w.displayName },
      create: { tenantId, code: w.code, displayName: w.displayName },
    });
  }
  return DEFAULT_WAREHOUSES.length;
}

async function seedCategories(tenantId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const c of CANONICAL_CATEGORIES) {
    const cat = await prisma.productCategory.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      update: { displayName: c.displayName.es, description: c.description },
      create: {
        tenantId,
        code: c.code,
        displayName: c.displayName.es,
        description: c.description,
      },
    });
    out.set(c.code, cat.id);
  }
  return out;
}

async function seedMenus(tenantId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const m of MENUS) {
    const menu = await prisma.menu.upsert({
      where: { tenantId_code: { tenantId, code: m.code } },
      update: { displayName: m.name },
      create: { tenantId, code: m.code, displayName: m.name },
    });
    out.set(m.code, menu.id);
  }
  return out;
}

interface ProductSeedResult {
  bySku: Map<string, string>;       // sku → product.id
  byLegacyName: Map<string, string>; // legacy name → product.id (para resolver recipe lines)
  imported: number;
  quarantined: { sku: string; name: string; reason: string }[];
  skippedForPromotion: string[];
}

async function seedProducts(
  tenantId: string,
  adminUserId: string,
  ingredients: LegacyIngredient[],
  categories: Map<string, string>,
): Promise<ProductSeedResult> {
  const bySku = new Map<string, string>();
  const byLegacyName = new Map<string, string>();
  const quarantined: { sku: string; name: string; reason: string }[] = [];
  const skippedForPromotion: string[] = [];
  const promotionNames = new Set(SUBRECIPE_PROMOTIONS.map((p) => p.productName));

  let imported = 0;

  for (const ing of ingredients) {
    if (promotionNames.has(ing.name.trim())) {
      skippedForPromotion.push(ing.name.trim());
      continue;
    }

    const canonical = resolveCanonicalCategory(ing.name, ing.legacyCategory);
    if (!canonical) {
      // Disuelto sin override y no es promoción → defensa: tirar
      throw new Error(
        `Ingredient "${ing.name}" with legacy category "${ing.legacyCategory}" has no canonical mapping`,
      );
    }
    const categoryId = categories.get(canonical);
    if (!categoryId) throw new Error(`Canonical category ${canonical} not seeded`);

    const sku = slug(ing.name);
    const isMissingCost = ing.packageCost == null;
    const isMissingSize = ing.packageSize == null;

    const product = await prisma.product.upsert({
      where: { tenantId_sku: { tenantId, sku } },
      update: {
        name: bilingual(ing.name.trim()),
        categoryId,
        baseUnit: ing.baseUnit,
        packageSize: ing.packageSize ?? null,
        packageCost: ing.packageCost ?? null,
        isActive: !isMissingCost,
        dataQualityIssue: isMissingCost ? 'MISSING_COST' : isMissingSize ? 'MISSING_PACKAGE_SIZE' : null,
      },
      create: {
        tenantId,
        sku,
        name: bilingual(ing.name.trim()),
        categoryId,
        baseUnit: ing.baseUnit,
        packageSize: ing.packageSize ?? null,
        packageCost: ing.packageCost ?? null,
        isActive: !isMissingCost,
        dataQualityIssue: isMissingCost ? 'MISSING_COST' : isMissingSize ? 'MISSING_PACKAGE_SIZE' : null,
      },
    });

    bySku.set(sku, product.id);
    byLegacyName.set(ing.name.trim(), product.id);
    imported++;

    // Snapshot inicial en histórico de precios
    if (ing.packageCost != null && ing.packageSize != null) {
      const exists = await prisma.productPriceHistory.findFirst({
        where: { productId: product.id },
      });
      if (!exists) {
        await prisma.productPriceHistory.create({
          data: {
            productId: product.id,
            packageCost: ing.packageCost,
            packageSize: ing.packageSize,
            source: 'seed:legacy-import',
            createdById: adminUserId,
          },
        });
      }
    }

    if (isMissingCost) {
      quarantined.push({
        sku,
        name: ing.name.trim(),
        reason: 'MISSING_COST',
      });
    }
  }

  return { bySku, byLegacyName, imported, quarantined, skippedForPromotion };
}

interface RecipeSeedResult {
  byCode: Map<string, string>;
  bySheetName: Map<string, string>;
  imported: number;
  totalLines: number;
  subRecipeRefs: number;
  warnings: string[];
}

async function seedRecipes(
  tenantId: string,
  legacyRecipes: Awaited<ReturnType<typeof readWorkbook>>['recipes'],
  productByLegacyName: Map<string, string>,
): Promise<RecipeSeedResult> {
  const byCode = new Map<string, string>();
  const bySheetName = new Map<string, string>();
  const warnings: string[] = [];
  let imported = 0;
  let totalLines = 0;
  let subRecipeRefs = 0;

  // Pasada 1: crear todas las recetas (sin líneas) para poder resolver sub-recetas
  for (const r of legacyRecipes) {
    const code = slug(r.sheetName);
    try {
      const recipe = await prisma.recipe.upsert({
        where: { tenantId_code: { tenantId, code } },
        update: {
          name: bilingual(r.sheetName.trim()),
          instructions: r.instructions ?? null,
          cookingTemp: truncate(r.cookingTemp, 40),
          cookingTime: truncate(r.cookingTime, 40),
        },
        create: {
          tenantId,
          code,
          name: bilingual(r.sheetName.trim()),
          instructions: r.instructions ?? null,
          cookingTemp: truncate(r.cookingTemp, 40),
          cookingTime: truncate(r.cookingTime, 40),
        },
      });
      byCode.set(code, recipe.id);
      bySheetName.set(r.sheetName.trim(), recipe.id);
      imported++;
    } catch (err) {
      warnings.push(
        `Receta "${r.sheetName}" (code=${code}) falló al insertar: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Pasada 2: poblar líneas resolviendo product vs sub-recipe
  // SUBRECIPE_PROMOTIONS define qué nombres legacy son sub-recetas, no productos.
  const subRecipeNameToSheet = new Map(
    SUBRECIPE_PROMOTIONS.map((p) => [p.productName, p.recipeSheetName] as const),
  );

  for (const r of legacyRecipes) {
    const code = slug(r.sheetName);
    const recipeId = byCode.get(code);
    if (!recipeId) continue;

    // Limpiar y reinsertar (idempotente)
    await prisma.recipeLine.deleteMany({ where: { recipeId } });

    for (const line of r.lines) {
      const trimmed = line.ingredientName.trim();
      const subSheetName = subRecipeNameToSheet.get(trimmed);

      let productId: string | null = null;
      let subRecipeId: string | null = null;

      if (subSheetName) {
        const ref = bySheetName.get(subSheetName);
        if (!ref) {
          warnings.push(
            `Receta "${r.sheetName}" referencia sub-receta "${subSheetName}" no encontrada`,
          );
          continue;
        }
        subRecipeId = ref;
        subRecipeRefs++;
      } else {
        const ref = productByLegacyName.get(trimmed);
        if (!ref) {
          warnings.push(
            `Receta "${r.sheetName}" referencia ingrediente "${trimmed}" no encontrado en catálogo`,
          );
          continue;
        }
        productId = ref;
      }

      // Determinar la unit de la línea: de momento heredamos del producto/sub-receta
      let unit = 'unit';
      if (productId) {
        const p = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
        unit = p.baseUnit;
      } else {
        unit = 'porcion';
      }

      await prisma.recipeLine.create({
        data: {
          recipeId,
          productId,
          subRecipeId,
          qtyPerPortion: line.qtyPerPortion,
          unit,
          position: line.position,
        },
      });
      totalLines++;
    }
  }

  return { byCode, bySheetName, imported, totalLines, subRecipeRefs, warnings };
}

async function writeReport(report: MigrationReport): Promise<string> {
  const dir = path.join(__dirname, 'reports');
  await fs.mkdir(dir, { recursive: true });
  const filename = `migration-report-${report.startedAt.replace(/[:.]/g, '-')}.json`;
  const out = path.join(dir, filename);
  await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf-8');
  return out;
}

async function main() {
  const startedAt = new Date();
  console.log('🌱 Brasa Brava — seed iniciando...');

  const excelPath =
    process.env.SEED_EXCEL_PATH ??
    path.resolve(__dirname, '../../../..', 'Plantilla Mauricio final.xlsm');

  console.log(`📂 Leyendo Excel: ${excelPath}`);
  const wb = await readWorkbook(excelPath);
  console.log(`   ↳ ${wb.ingredients.length} ingredientes, ${wb.recipes.length} recetas`);

  const tenant = await seedTenant();
  console.log(`🏢 Tenant: ${tenant.code} (${tenant.id})`);

  const rolesCreated = await seedRoles();
  console.log(`👥 Roles: ${rolesCreated}`);

  const admin = await seedAdmin(tenant.id);
  console.log(`👤 Admin: ${admin.email}`);

  const warehousesCreated = await seedWarehouses(tenant.id);
  console.log(`🏪 Almacenes: ${warehousesCreated}`);

  const categories = await seedCategories(tenant.id);
  console.log(`🏷️  Categorías canónicas: ${categories.size}`);

  const menus = await seedMenus(tenant.id);
  console.log(`📋 Menús: ${menus.size}`);

  const products = await seedProducts(tenant.id, admin.id, wb.ingredients, categories);
  console.log(`📦 Productos importados: ${products.imported} (${products.quarantined.length} en cuarentena)`);

  const recipes = await seedRecipes(tenant.id, wb.recipes, products.byLegacyName);
  console.log(`📜 Recetas: ${recipes.imported} (${recipes.totalLines} líneas, ${recipes.subRecipeRefs} sub-recetas)`);

  if (recipes.warnings.length) {
    console.warn(`⚠️  ${recipes.warnings.length} warnings durante la importación de recetas`);
    recipes.warnings.slice(0, 10).forEach((w) => console.warn(`   - ${w}`));
  }

  const finishedAt = new Date();
  const report: MigrationReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    excelPath,
    tenant,
    rolesCreated,
    adminUser: admin,
    warehousesCreated,
    menusCreated: menus.size,
    categories: {
      canonical: categories.size,
      legacyMapped: Object.keys(PRODUCT_OVERRIDES).length,
    },
    products: {
      imported: products.imported,
      quarantined: products.quarantined,
      promotedToRecipes: SUBRECIPE_PROMOTIONS.map((p) => ({
        name: p.productName,
        recipeCode: slug(p.recipeSheetName),
      })),
    },
    recipes: {
      imported: recipes.imported,
      lines: recipes.totalLines,
      subRecipeRefs: recipes.subRecipeRefs,
    },
    warnings: recipes.warnings,
  };

  const reportPath = await writeReport(report);
  console.log(`📊 Reporte de migración: ${reportPath}`);
  console.log('✅ Seed completado');
}

main()
  .catch(async (e) => {
    console.error('❌ Seed falló:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
