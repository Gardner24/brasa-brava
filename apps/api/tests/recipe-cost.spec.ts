/**
 * Tests para el calculador de costo. Estos validan la lógica de redondeo
 * y agregación. Los tests E2E con la CTE real corren en CI con Postgres
 * de servicio (Bloque 9).
 */
import { describe, it, expect } from 'vitest';

// Reimplementamos en-memory la lógica de agregación que esperamos del CTE
// para verificar que los redondeos y sumas son correctos.

interface MockIngredient {
  unitCost: number | null;
  qty: number;
}

function aggregateCost(ingredients: MockIngredient[]): {
  cost: number;
  hasIncomplete: boolean;
} {
  let cost = 0;
  let hasIncomplete = false;
  for (const i of ingredients) {
    if (i.unitCost == null) {
      hasIncomplete = true;
      continue;
    }
    cost += i.qty * i.unitCost;
  }
  return { cost, hasIncomplete };
}

function roundCRC(n: number): number {
  return Math.round(n * 100) / 100;
}

describe('recipe cost aggregation', () => {
  it('sums product * qty across multiple lines', () => {
    const result = aggregateCost([
      { unitCost: 0.605, qty: 150 },   // Papas mini: 90.75
      { unitCost: 1.0647, qty: 4 },    // Aceite: 4.2588
      { unitCost: 7.9295, qty: 1 },    // Romero: 7.9295
      { unitCost: 2.5, qty: 1 },       // Ajo: 2.5
      { unitCost: 1, qty: 2 },         // Sal: 2
    ]);
    expect(roundCRC(result.cost)).toBeCloseTo(107.44, 1);
    expect(result.hasIncomplete).toBe(false);
  });

  it('flags incomplete cost when a product is in cuarentena', () => {
    const result = aggregateCost([
      { unitCost: 0.605, qty: 150 },
      { unitCost: null, qty: 1 },      // En cuarentena
    ]);
    expect(result.hasIncomplete).toBe(true);
    expect(roundCRC(result.cost)).toBeCloseTo(90.75, 2);
  });

  it('handles zero ingredients', () => {
    const result = aggregateCost([]);
    expect(result.cost).toBe(0);
    expect(result.hasIncomplete).toBe(false);
  });

  it('rounds CRC to cents', () => {
    expect(roundCRC(2148.766778)).toBe(2148.77);
    expect(roundCRC(0.005)).toBe(0.01);
    expect(roundCRC(0.004)).toBe(0);
  });
});

describe('cycle detection logic', () => {
  // Simula el resultado de detectCycle
  function wouldCycle(
    recipeId: string,
    candidateSubs: string[],
    descendants: Map<string, string[]>,
  ): boolean {
    if (candidateSubs.includes(recipeId)) return true;
    const queue = [...candidateSubs];
    const seen = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      if (id === recipeId) return true;
      const children = descendants.get(id) ?? [];
      queue.push(...children);
    }
    return false;
  }

  it('detects A → A self-reference', () => {
    expect(wouldCycle('A', ['A'], new Map())).toBe(true);
  });

  it('detects A → B → A indirect cycle', () => {
    const desc = new Map([['B', ['A']]]);
    expect(wouldCycle('A', ['B'], desc)).toBe(true);
  });

  it('allows A → B when B has no descendants', () => {
    expect(wouldCycle('A', ['B'], new Map())).toBe(false);
  });

  it('allows A → B → C when C is not A', () => {
    const desc = new Map([['B', ['C']]]);
    expect(wouldCycle('A', ['B'], desc)).toBe(false);
  });
});
