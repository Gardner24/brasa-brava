/**
 * Lector tipado de Plantilla Mauricio final.xlsm.
 * Devuelve estructuras planas (sin acoplar a Prisma) para que el seed
 * las consuma. Soporta re-corridas idempotentes.
 */

import ExcelJS from 'exceljs';

export interface LegacyIngredient {
  name: string;
  legacyCategory: string;
  packageCost: number | null;
  baseUnit: string; // 'g' | 'ml' | 'unit'
  packageSize: number | null;
  flagAmericana: boolean;
  flagArgentina: boolean;
  flagTica: boolean;
}

export interface LegacyRecipeLine {
  ingredientName: string; // tal cual aparece en la celda C de la receta
  qtyPerPortion: number;
  position: number;
}

export interface LegacyRecipe {
  sheetName: string;
  lines: LegacyRecipeLine[];
  instructions: string | null;
  cookingTemp: string | null;
  cookingTime: string | null;
}

export interface LegacyWorkbook {
  ingredients: LegacyIngredient[];
  recipes: LegacyRecipe[];
}

const NON_RECIPE_SHEETS = new Set(['Ingredientes', 'Home', 'Americana', 'Argentina', 'Tica']);

function normalizeUnit(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'gr' || s === 'g' || s === 'gramos') return 'g';
  if (s === 'ml' || s === 'mililitros') return 'ml';
  if (s === 'unit' || s === 'unidad' || s === 'u') return 'unit';
  return s || 'unit';
}

function asNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  // Algunas celdas vienen como objeto resultado de fórmula
  if (typeof raw === 'object' && raw !== null && 'result' in raw) {
    const r = (raw as { result: unknown }).result;
    return asNumber(r);
  }
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function asString(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw === 'object' && raw !== null) {
    if ('result' in raw) return asString((raw as { result: unknown }).result);
    if ('text' in raw) return asString((raw as { text: unknown }).text);
    if ('richText' in raw) {
      const rt = (raw as { richText: Array<{ text: string }> }).richText;
      return rt.map((p) => p.text).join('').trim() || null;
    }
  }
  return String(raw).trim() || null;
}

function asBool(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  const s = asString(raw)?.toLowerCase();
  return s === 'true' || s === 'verdadero' || s === '1';
}

export async function readWorkbook(path: string): Promise<LegacyWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);

  const ingredients = readIngredients(wb);
  const recipes = readRecipes(wb);

  return { ingredients, recipes };
}

function readIngredients(wb: ExcelJS.Workbook): LegacyIngredient[] {
  const ws = wb.getWorksheet('Ingredientes');
  if (!ws) throw new Error("Sheet 'Ingredientes' not found");

  const result: LegacyIngredient[] = [];
  // Headers en fila 1: A=Producto B=Categoría C=Costo Producto D=Unidad E=Peso F=Costo Unidad G=A H=G I=T
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const name = asString(row.getCell(1).value);
    if (!name) return; // fila vacía
    const legacyCategory = asString(row.getCell(2).value);
    if (!legacyCategory) return;

    result.push({
      name,
      legacyCategory,
      packageCost: asNumber(row.getCell(3).value),
      baseUnit: normalizeUnit(row.getCell(4).value),
      packageSize: asNumber(row.getCell(5).value),
      flagAmericana: asBool(row.getCell(7).value),
      flagArgentina: asBool(row.getCell(8).value),
      flagTica: asBool(row.getCell(9).value),
    });
  });

  return result;
}

function readRecipes(wb: ExcelJS.Workbook): LegacyRecipe[] {
  const recipes: LegacyRecipe[] = [];

  wb.eachSheet((ws) => {
    const name = ws.name.trim();
    if (NON_RECIPE_SHEETS.has(name)) return;

    // Estructura de receta:
    //   Headers en fila 9. Datos desde fila 10.
    //   B=Categoría (lookup) C=Ingredientes D=Costo Unit E=Unid F=Cantidad Porción
    //   L10 = Indicaciones, L19/M19/N19 = labels temp/tiempo, L20-N20 valores
    const lines: LegacyRecipeLine[] = [];
    let position = 0;
    for (let r = 10; r <= 30; r++) {
      const ingredientName = asString(ws.getCell(r, 3).value);
      const qty = asNumber(ws.getCell(r, 6).value);
      if (!ingredientName || qty == null) continue;
      position++;
      lines.push({ ingredientName, qtyPerPortion: qty, position });
    }

    const instructions = asString(ws.getCell(10, 12).value); // L10
    const cookingTemp = asString(ws.getCell(20, 12).value); // L20
    const cookingTime = asString(ws.getCell(20, 14).value); // N20

    if (lines.length === 0) return; // hojas vacías o no-receta

    recipes.push({
      sheetName: name,
      lines,
      instructions,
      cookingTemp,
      cookingTime,
    });
  });

  return recipes;
}
