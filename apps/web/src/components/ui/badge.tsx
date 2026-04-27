import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn.ts';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-brand text-brand-foreground',
        secondary: 'bg-muted text-foreground',
        outline: 'border border-input',
        destructive: 'bg-destructive/15 text-destructive',
        success: 'bg-success/15 text-success',
        warning: 'bg-warning/15 text-warning',
        // Variantes por categoría canónica del catálogo
        carnes: 'bg-ember/15 text-ember-dim',
        especias: 'bg-muted text-foreground/80',
        salsas: 'bg-ember/10 text-ember-dim/85',
        aceites_grasas: 'bg-warning/15 text-warning',
        lacteos: 'bg-cream-tortilla text-wood-dark',
        frutas_verduras: 'bg-success/12 text-success',
        bebidas: 'bg-foreground/8 text-foreground/70',
        abarrotes: 'bg-wood/15 text-wood-dark',
        preparados: 'bg-foreground/8 text-foreground/70',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Convierte un código canónico (CARNES, ESPECIAS...) al variant correspondiente. */
export function categoryVariant(code: string): NonNullable<BadgeProps['variant']> {
  const map: Record<string, NonNullable<BadgeProps['variant']>> = {
    CARNES: 'carnes',
    ESPECIAS: 'especias',
    SALSAS: 'salsas',
    ACEITES_GRASAS: 'aceites_grasas',
    LACTEOS: 'lacteos',
    FRUTAS_VERDURAS: 'frutas_verduras',
    BEBIDAS: 'bebidas',
    ABARROTES: 'abarrotes',
    PREPARADOS: 'preparados',
  };
  return map[code] ?? 'secondary';
}
