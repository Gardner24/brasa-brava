/**
 * Entidad de dominio Product.
 *
 * Reglas de negocio puras (sin dependencias de Prisma, Fastify, ni infra).
 * Esta es la capa que un test unitario puede ejercitar sin DB.
 */

export type BaseUnit = 'g' | 'ml' | 'unit';
export type DataQualityIssue = 'MISSING_COST' | 'MISSING_PACKAGE_SIZE' | 'AMBIGUOUS_UNIT';

export interface ProductProps {
  id: string;
  tenantId: string;
  sku: string;
  name: { es: string; en: string };
  categoryId: string;
  baseUnit: BaseUnit;
  packageSize: number | null;
  packageCost: number | null;
  reorderPoint: number | null;
  reorderQty: number | null;
  isActive: boolean;
  dataQualityIssue: DataQualityIssue | null;
}

export class Product {
  private constructor(private props: ProductProps) {}

  static create(props: ProductProps): Product {
    if (!props.sku.trim()) throw new Error('Product.sku required');
    if (!props.name.es.trim()) throw new Error('Product.name.es required');
    if (!['g', 'ml', 'unit'].includes(props.baseUnit)) {
      throw new Error(`Invalid baseUnit: ${props.baseUnit}`);
    }
    return new Product({ ...props });
  }

  /** Costo unitario calculado: package_cost / package_size */
  get unitCost(): number | null {
    if (this.props.packageCost == null || this.props.packageSize == null) return null;
    if (this.props.packageSize <= 0) return null;
    return this.props.packageCost / this.props.packageSize;
  }

  /** ¿Está debajo del punto de pedido? */
  isBelowReorderPoint(qtyOnHand: number): boolean {
    if (this.props.reorderPoint == null) return false;
    return qtyOnHand < this.props.reorderPoint;
  }

  /** El producto se considera operacional sólo si está activo y tiene costo. */
  get isOperational(): boolean {
    return this.props.isActive && this.unitCost !== null;
  }

  toJSON(): ProductProps & { unitCost: number | null } {
    return { ...this.props, unitCost: this.unitCost };
  }
}
