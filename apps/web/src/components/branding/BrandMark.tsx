import { cn } from '@/lib/cn.ts';

interface Props {
  /** "sm" | "md" | "lg" — controla tamaño del flame y de la tipografía */
  size?: 'sm' | 'md' | 'lg';
  /** Si true, oculta el subtítulo "Inventario y Auditoría" */
  compact?: boolean;
  className?: string;
  /** Color de la llama. Default: brand. Útil para mostrar en hero oscuro. */
  flameColor?: string;
  textClassName?: string;
}

const SIZES = {
  sm: { flame: 'h-4 w-4', title: 'text-sm', sub: 'text-[10px]' },
  md: { flame: 'h-6 w-6', title: 'text-base', sub: 'text-xs' },
  lg: { flame: 'h-8 w-8', title: 'text-xl', sub: 'text-sm' },
} as const;

export function BrandMark({
  size = 'md',
  compact = false,
  className,
  flameColor,
  textClassName,
}: Props) {
  const s = SIZES[size];
  // Con exactOptionalPropertyTypes:true, debemos omitir `style` cuando no
  // hay color en lugar de pasar `undefined`. Spread condicional logra eso.
  const flameStyle = flameColor ? { style: { color: flameColor } } : {};
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Flame className={cn(s.flame, !flameColor && 'text-brand')} {...flameStyle} />
      <div className={textClassName}>
        <p className={cn('font-display font-medium leading-none', s.title)}>Brasa Brava</p>
        {!compact && (
          <p className={cn('mt-1 uppercase tracking-[0.18em] text-muted-foreground', s.sub)}>
            Inventario
          </p>
        )}
      </div>
    </div>
  );
}

function Flame({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
    </svg>
  );
}
