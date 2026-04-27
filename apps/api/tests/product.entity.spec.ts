import { describe, it, expect } from 'vitest';
import { Product } from '../src/domain/product/product.entity.js';

const base = {
  id: '00000000-0000-0000-0000-000000000001',
  tenantId: '00000000-0000-0000-0000-000000000002',
  sku: 'ACEITE',
  name: { es: 'Aceite', en: 'Oil' },
  categoryId: '00000000-0000-0000-0000-000000000003',
  baseUnit: 'ml' as const,
  packageSize: 17000,
  packageCost: 18100,
  reorderPoint: 1000,
  reorderQty: 5000,
  isActive: true,
  dataQualityIssue: null,
};

describe('Product', () => {
  it('computes unit cost as packageCost / packageSize', () => {
    const p = Product.create(base);
    expect(p.unitCost).toBeCloseTo(18100 / 17000, 6);
  });

  it('returns null unit cost when packageCost is missing', () => {
    const p = Product.create({ ...base, packageCost: null });
    expect(p.unitCost).toBeNull();
    expect(p.isOperational).toBe(false);
  });

  it('detects below-reorder-point', () => {
    const p = Product.create(base);
    expect(p.isBelowReorderPoint(500)).toBe(true);
    expect(p.isBelowReorderPoint(1500)).toBe(false);
  });

  it('rejects empty SKU', () => {
    expect(() => Product.create({ ...base, sku: '' })).toThrow();
  });

  it('rejects invalid baseUnit', () => {
    // @ts-expect-error invalid unit on purpose
    expect(() => Product.create({ ...base, baseUnit: 'kg' })).toThrow();
  });
});
