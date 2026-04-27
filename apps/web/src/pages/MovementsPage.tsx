import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCcw } from 'lucide-react';
import type { MovementType } from '@brasa/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useMovements, useWarehouses } from '@/lib/queries.ts';
import { RegisterMovementDrawer } from '@/components/movements/RegisterMovementDrawer.tsx';

const MOVEMENT_TYPES: MovementType[] = [
  'PURCHASE',
  'CONSUMPTION',
  'WASTE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT',
  'RETURN',
  'INITIAL',
];

export function MovementsPage() {
  const { t, i18n } = useTranslation('movements');
  const { t: tc } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'es') as 'es' | 'en';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [movementType, setMovementType] = useState<MovementType | ''>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState(1);

  const warehouses = useWarehouses();

  const query = useMemo(
    () => ({
      ...(warehouseId ? { warehouseId } : {}),
      ...(movementType ? { movementType: movementType as MovementType } : {}),
      ...(fromDate ? { fromDate: new Date(fromDate).toISOString() } : {}),
      ...(toDate ? { toDate: new Date(toDate + 'T23:59:59').toISOString() } : {}),
      page,
      pageSize: 50,
    }),
    [warehouseId, movementType, fromDate, toDate, page],
  );

  const movements = useMovements(query);
  const total = movements.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('registerCta')}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('filters.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('filters.warehouse')}
            <Select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('filters.allWarehouses')}</option>
              {warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.displayName} ({w.code})
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('filters.type')}
            <Select
              value={movementType}
              onChange={(e) => {
                setMovementType(e.target.value as MovementType | '');
                setPage(1);
              }}
            >
              <option value="">{t('filters.allTypes')}</option>
              {MOVEMENT_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {t(`movementType.${mt}`)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('filters.fromDate')}
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('filters.toDate')}
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/30 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t('cols.date')}</th>
                <th className="px-4 py-3">{t('cols.type')}</th>
                <th className="px-4 py-3">{t('cols.product')}</th>
                <th className="px-4 py-3">{t('cols.warehouse')}</th>
                <th className="px-4 py-3 text-right">{t('cols.qty')}</th>
                <th className="px-4 py-3 text-right">{t('cols.unitCost')}</th>
                <th className="px-4 py-3 text-right">{t('cols.totalValue')}</th>
                <th className="px-4 py-3">{t('cols.notes')}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {movements.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={8} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : movements.data && movements.data.data.length > 0 ? (
                movements.data.data.map((m) => (
                  <tr key={m.id} className="border-b hover:bg-muted/40">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(m.performedAt, locale)}
                    </td>
                    <td className="px-4 py-3">{movementTypeBadge(m.movementType, t)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {m.productSku}
                      </span>
                      <span className="ml-2">{m.productName[locale] ?? m.productName.es}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{m.warehouseCode}</td>
                    <td
                      className={
                        m.qty < 0
                          ? 'px-4 py-3 text-right tabular-nums text-destructive'
                          : 'px-4 py-3 text-right tabular-nums'
                      }
                    >
                      {formatNumber(m.qty)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs">
                      {m.unitCost == null ? '—' : formatCRC(m.unitCost)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCRC(m.totalValue)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {m.notes ?? '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            {tc('catalog.pagination.showing', {
              defaultValue: 'Mostrando {{count}} de {{total}}',
              count: movements.data?.data.length ?? 0,
              total,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => movements.refetch()}
              disabled={movements.isFetching}
            >
              <RefreshCcw className="mr-1 h-3 w-3" />
              {tc('actions.refresh')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {tc('catalog.pagination.prev', { defaultValue: 'Anterior' })}
            </Button>
            <span className="text-xs">{`${page} / ${totalPages}`}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {tc('catalog.pagination.next', { defaultValue: 'Siguiente' })}
            </Button>
          </div>
        </div>
      </Card>

      <RegisterMovementDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}

function movementTypeBadge(
  type: MovementType,
  t: (k: string) => string,
): JSX.Element {
  const variantMap: Record<MovementType, 'success' | 'destructive' | 'warning' | 'secondary' | 'outline'> = {
    PURCHASE: 'success',
    CONSUMPTION: 'secondary',
    WASTE: 'destructive',
    TRANSFER_IN: 'outline',
    TRANSFER_OUT: 'outline',
    ADJUSTMENT: 'warning',
    RETURN: 'outline',
    INITIAL: 'secondary',
  };
  return <Badge variant={variantMap[type]}>{t(`movementType.${type}`)}</Badge>;
}

function formatDate(iso: string, locale: 'es' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-CR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function formatCRC(n: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-CR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}
