import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Plus, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Badge, categoryVariant } from '@/components/ui/badge.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import {
  useCategories,
  useStock,
  useStockValuation,
  useWarehouses,
} from '@/lib/queries.ts';

export function InventoryPage() {
  const { t, i18n } = useTranslation('inventory');
  const { t: tc } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'es') as 'es' | 'en';

  const [searchParams, setSearchParams] = useSearchParams();
  const warehouseIdFromUrl = searchParams.get('warehouseId') ?? '';

  const [categoryCode, setCategoryCode] = useState<string>('');
  const [belowReorderOnly, setBelowReorderOnly] = useState(false);
  const [negativeOnly, setNegativeOnly] = useState(false);

  const warehouses = useWarehouses();
  const categories = useCategories();

  // Selecciona el warehouse activo: prioriza la URL, sino el primer activo
  const activeWarehouseId = useMemo(() => {
    if (warehouseIdFromUrl) return warehouseIdFromUrl;
    const first = warehouses.data?.find((w) => w.isActive);
    return first?.id ?? '';
  }, [warehouseIdFromUrl, warehouses.data]);

  const stockQuery = activeWarehouseId
    ? {
        warehouseId: activeWarehouseId,
        ...(categoryCode ? { categoryCode } : {}),
        ...(belowReorderOnly ? { belowReorderOnly: true } : {}),
        ...(negativeOnly ? { negativeOnly: true } : {}),
      }
    : undefined;

  const stock = useStock(stockQuery);
  const valuation = useStockValuation(activeWarehouseId || undefined);

  const activeWarehouse = warehouses.data?.find((w) => w.id === activeWarehouseId);

  const handleWarehouseChange = (newId: string): void => {
    if (newId) {
      setSearchParams({ warehouseId: newId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">{t('inventory.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {activeWarehouse
              ? `${activeWarehouse.displayName} · ${activeWarehouse.code}`
              : t('inventory.subtitle')}
          </p>
        </div>
        <Button disabled={!activeWarehouseId}>
          <Plus className="mr-2 h-4 w-4" />
          {t('inventory.registerMovement')}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('inventory.filters.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('inventory.filters.warehouse')}
            <Select
              value={activeWarehouseId}
              onChange={(e) => handleWarehouseChange(e.target.value)}
            >
              <option value="">{t('inventory.selectWarehouse')}</option>
              {warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.displayName} ({w.code})
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('inventory.filters.category')}
            <Select value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)}>
              <option value="">{t('inventory.filters.allCategories')}</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.displayName}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 self-end rounded-md border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={belowReorderOnly}
              onChange={(e) => setBelowReorderOnly(e.target.checked)}
            />
            {t('inventory.filters.belowReorderOnly')}
          </label>
          <label className="flex items-center gap-2 self-end rounded-md border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={negativeOnly}
              onChange={(e) => setNegativeOnly(e.target.checked)}
            />
            {t('inventory.filters.negativeOnly')}
          </label>
        </CardContent>
      </Card>

      {valuation.data && valuation.data.totals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('inventory.valuation.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {valuation.data.totals.map((row) => (
                <div
                  key={row.categoryCode}
                  className="rounded-md border bg-muted/30 px-3 py-2"
                >
                  <Badge variant={categoryVariant(row.categoryCode)} className="mb-1">
                    {row.categoryCode}
                  </Badge>
                  <p className="font-display text-base tabular-nums">
                    {formatCRC(row.totalValueCRC)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {row.itemsCount} {t('inventory.valuation.items')}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 border-t pt-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('inventory.valuation.grandTotal')}
              </span>
              <span className="font-display text-lg tabular-nums text-brand">
                {formatCRC(valuation.data.grandTotalCRC)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/30 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t('inventory.cols.sku')}</th>
                <th className="px-4 py-3">{t('inventory.cols.name')}</th>
                <th className="px-4 py-3">{t('inventory.cols.category')}</th>
                <th className="px-4 py-3 text-right">{t('inventory.cols.qty')}</th>
                <th className="px-4 py-3">{t('inventory.cols.unit')}</th>
                <th className="px-4 py-3 text-right">{t('inventory.cols.avgUnitCost')}</th>
                <th className="px-4 py-3 text-right">{t('inventory.cols.totalValue')}</th>
                <th className="px-4 py-3 text-right">{t('inventory.cols.reorderPoint')}</th>
                <th className="px-4 py-3 text-right">{t('inventory.cols.daysCoverage')}</th>
                <th className="px-4 py-3">{t('inventory.cols.status')}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {!activeWarehouseId ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    {t('inventory.selectWarehouse')}
                  </td>
                </tr>
              ) : stock.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={10} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : stock.data && stock.data.length > 0 ? (
                stock.data.map((row) => (
                  <tr key={row.productId} className="border-b hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs">{row.productSku}</td>
                    <td className="px-4 py-3">{row.productName[locale] ?? row.productName.es}</td>
                    <td className="px-4 py-3">
                      <Badge variant={categoryVariant(row.categoryCode)}>
                        {row.categoryCode}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumber(row.qtyOnHand)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{row.baseUnit}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.avgUnitCost == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatCRC(row.avgUnitCost)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCRC(row.totalValue)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                      {row.reorderPoint == null ? '—' : formatNumber(row.reorderPoint)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs">
                      {row.daysCoverage == null ? (
                        <span className="text-muted-foreground">{t('inventory.noCoverage')}</span>
                      ) : (
                        Math.round(row.daysCoverage)
                      )}
                    </td>
                    <td className="px-4 py-3">{stockStatusBadge(row, t)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    {t('inventory.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-4 py-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => stock.refetch()}
            disabled={!activeWarehouseId || stock.isFetching}
          >
            <RefreshCcw className="mr-1 h-3 w-3" />
            {tc('actions.refresh')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface StockRow {
  qtyOnHand: number;
  reorderPoint: number | null;
  isBelowReorder: boolean;
  isNegative: boolean;
}

function stockStatusBadge(
  row: StockRow,
  t: (key: string) => string,
): JSX.Element {
  if (row.isNegative) {
    return <Badge variant="destructive">{t('inventory.status.negative')}</Badge>;
  }
  if (row.isBelowReorder) {
    return <Badge variant="warning">{t('inventory.status.low')}</Badge>;
  }
  if (row.reorderPoint == null) {
    return <Badge variant="outline">{t('inventory.status.noData')}</Badge>;
  }
  return <Badge variant="success">{t('inventory.status.ok')}</Badge>;
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
