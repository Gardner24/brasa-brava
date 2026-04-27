import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Package,
  ScrollText,
  Warehouse,
  ClipboardCheck,
  ArrowLeftRight,
  BellRing,
  History,
} from 'lucide-react';
import { cn } from '@/lib/cn.ts';
import { BrandMark } from '@/components/branding/BrandMark.tsx';

interface NavItem {
  key: string;
  icon: LucideIcon;
  to: string;
  disabled?: boolean;
}

const items: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { key: 'catalog', icon: Package, to: '/catalog' },
  { key: 'recipes', icon: ScrollText, to: '/recipes' },
  { key: 'warehouses', icon: Warehouse, to: '/warehouses' },
  { key: 'inventory', icon: Package, to: '/inventory' },
  { key: 'audits', icon: ClipboardCheck, to: '/audits', disabled: true },
  { key: 'movements', icon: ArrowLeftRight, to: '/movements', disabled: true },
  { key: 'alerts', icon: BellRing, to: '/alerts', disabled: true },
];

const adminItems: NavItem[] = [
  { key: 'auditLog', icon: History, to: '/admin/audit-log' },
];

export function Sidebar() {
  const { t } = useTranslation();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar md:flex">
      <div className="border-b border-border/60 px-6 py-5">
        <BrandMark size="md" />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((it) =>
          it.disabled ? (
            <span
              key={it.key}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/55"
            >
              <it.icon className="h-4 w-4" />
              {t(`nav.${it.key}`)}
              <span className="ml-auto text-[9px] uppercase tracking-wider">soon</span>
            </span>
          ) : (
            <NavLink
              key={it.key}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-card font-medium text-foreground shadow-[inset_3px_0_0_hsl(var(--brand))]'
                    : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <it.icon className={cn('h-4 w-4', isActive && 'text-brand')} />
                  {t(`nav.${it.key}`)}
                </>
              )}
            </NavLink>
          ),
        )}

        <div className="mt-6 border-t border-border/50 pt-3">
          <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/80">
            {t('nav.admin')}
          </p>
          {adminItems.map((it) => (
            <NavLink
              key={it.key}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-card font-medium text-foreground shadow-[inset_3px_0_0_hsl(var(--brand))]'
                    : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <it.icon className={cn('h-4 w-4', isActive && 'text-brand')} />
                  {t(`nav.${it.key}`)}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-t border-border/60 px-6 py-3">
        <p className="font-display text-xs italic text-muted-foreground">
          "La brasa decide, la receta concuerda."
        </p>
      </div>
    </aside>
  );
}
