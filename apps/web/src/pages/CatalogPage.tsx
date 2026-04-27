import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, AlertTriangle, Package, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Badge, categoryVariant } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useCategories, useProducts } from '@/lib/queries.ts';

export function CatalogPage() {
  const { t, i18n } = useTranslation('catalog');
  const { t: tc } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'es') as 'es' | 'en';

  const [search, setSearch] = useState('');
  const [categoryCode, setCategoryCode] = useState<string>('');
  const [showQuarantine, setShowQuarantine] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(categoryCode ? { categoryCode } : {}),
      ...(showQuarantine ? { dataQualityIssue: 'MISSING_COST' as const } : {}),
      ...(includeArchived ? {} : { isActive: true }),
      page,
      pageSize: 50,
    }),
    [search, categoryCode, showQuarantine, includeArchived, page],
  );

  const products = useProducts(query);
  const categories = useCategories();

  const total = products.data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button>
          <Package className="mr-2 h-4 w-4" />
          {t('newProduct')}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('filters.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('filters.searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={categoryCode}
            onChange={(e) => {
              setCategoryCode(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('filters.allCategories')}</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.code}>
                {c.displayName} ({c.productsCount})
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={showQuarantine}
              onChange={(e) => {
                setShowQuarantine(e.target.checked);
                setPage(1);
              }}
            />
            <AlertTriangle className="h-4 w-4 text-warning" />
            {t('filters.quarantineOnly')}
          </label>
          <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => {
                setIncludeArchived(e.target.checked);
                setPage(1);
              }}
            />
            {t('filters.includeArchived')}
          </label>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/30 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t('cols.sku')}</th>
                <th className="px-4 py-3">{t('cols.name')}</th>
                <th className="px-4 py-3">{t('cols.category')}</th>
                <th className="px-4 py-3 text-right">{t('cols.unitCost')}</th>
                <th className="px-4 py-3">{t('cols.unit')}</th>
                <th className="px-4 py-3">{t('cols.status')}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {products.isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                : products.data?.data.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                      <td className="px-4 py-3">
                        {p.name[locale] ?? p.name.es}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={categoryVariant(p.categoryCode)}>{p.categoryCode}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {p.unitCost == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatCRC(p.unitCost)
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.baseUnit}</td>
                      <td className="px-4 py-3">
                        {!p.isActive ? (
                          <Badge variant="outline">{t('status.archived')}</Badge>
                        ) : p.dataQualityIssue === 'MISSING_COST' ? (
                          <Badge variant="warning">{t('status.quarantine')}</Badge>
                        ) : (
                          <Badge variant="success">{t('status.ok')}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            {t('pagination.showing', { count: products.data?.data.length ?? 0, total })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => products.refetch()}
              disabled={products.isFetching}
            >
              <RefreshCcw className="mr-1 h-3 w-3" />
              {tc('actions.refresh', 'Refrescar')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('pagination.prev')}
            </Button>
            <span className="text-xs">{`${page} / ${Math.max(1, totalPages)}`}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function formatCRC(n: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
