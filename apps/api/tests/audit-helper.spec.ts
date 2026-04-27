import { describe, it, expect } from 'vitest';
import { computeDiff } from '../src/application/shared/audit-helper.js';

describe('computeDiff', () => {
  it('returns null when both null', () => {
    expect(computeDiff(null, null)).toBeNull();
  });

  it('marks created when before is null', () => {
    expect(computeDiff(null, { sku: 'X' })).toEqual({ type: 'created', after: { sku: 'X' } });
  });

  it('marks deleted when after is null', () => {
    expect(computeDiff({ sku: 'X' }, null)).toEqual({ type: 'deleted', before: { sku: 'X' } });
  });

  it('returns null when objects are equal', () => {
    expect(computeDiff({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBeNull();
  });

  it('lists changed fields', () => {
    const result = computeDiff(
      { sku: 'X', cost: 100, isActive: true },
      { sku: 'X', cost: 120, isActive: false },
    );
    expect(result).toEqual({
      type: 'updated',
      changes: [
        { field: 'cost', before: 100, after: 120 },
        { field: 'isActive', before: true, after: false },
      ],
    });
  });

  it('handles nested objects via JSON equality', () => {
    expect(
      computeDiff(
        { name: { es: 'Aceite', en: 'Oil' } },
        { name: { es: 'Aceite Premium', en: 'Oil' } },
      ),
    ).toMatchObject({
      type: 'updated',
      changes: [
        {
          field: 'name',
          before: { es: 'Aceite', en: 'Oil' },
          after: { es: 'Aceite Premium', en: 'Oil' },
        },
      ],
    });
  });
});
