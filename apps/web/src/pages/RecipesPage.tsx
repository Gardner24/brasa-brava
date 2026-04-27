import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ScrollText, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useRecipe, useRecipes } from '@/lib/queries.ts';

export function RecipesPage() {
  const { t, i18n } = useTranslation('recipes');
  const locale = (i18n.resolvedLanguage ?? 'es') as 'es' | 'en';

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useMemo(
    () => ({
      ...(search ? { search } : {}),
      isActive: true,
      pageSize: 100,
    }),
    [search],
  );

  const recipes = useRecipes(query);
  const detail = useRecipe(selectedId ?? undefined);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[400px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">{t('title')}</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="max-h-[600px] overflow-y-auto p-0">
          {recipes.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {recipes.data?.data.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
                      selectedId === r.id ? 'bg-muted/60' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.name[locale] ?? r.name.es}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.code} · {t('linesCount', { count: r.linesCount })}
                      </p>
                    </div>
                    <ScrollText className="ml-2 h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        {!selectedId ? (
          <CardContent className="flex h-[600px] items-center justify-center text-center text-muted-foreground">
            <div>
              <ScrollText className="mx-auto h-10 w-10 opacity-30" />
              <p className="mt-2 text-sm">{t('emptyState')}</p>
            </div>
          </CardContent>
        ) : detail.isLoading ? (
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        ) : detail.data ? (
          <RecipeDetail recipe={detail.data} locale={locale} />
        ) : null}
      </Card>
    </div>
  );
}

function RecipeDetail({
  recipe,
  locale,
}: {
  recipe: import('@brasa/shared-types').RecipeDetailDTO;
  locale: 'es' | 'en';
}) {
  const { t } = useTranslation('recipes');
  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="font-display text-2xl">{recipe.name[locale] ?? recipe.name.es}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {recipe.code} · {t('yield', { qty: recipe.yieldQty, unit: recipe.yieldUnit })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-muted-foreground">{t('costPerPortion')}</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCRC(recipe.costPerPortion)}</p>
            {recipe.hasIncompleteCost && (
              <Badge variant="warning" className="mt-1">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {t('incompleteCost')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">{t('cols.ingredient')}</th>
              <th className="py-2 text-right">{t('cols.qty')}</th>
              <th className="py-2">{t('cols.unit')}</th>
              <th className="py-2 text-right">{t('cols.unitCost')}</th>
              <th className="py-2 text-right">{t('cols.lineCost')}</th>
            </tr>
          </thead>
          <tbody>
            {recipe.lines.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="py-2">
                  {l.productName ? (
                    l.productName[locale] ?? l.productName.es
                  ) : (
                    <span className="italic text-muted-foreground">
                      → {l.subRecipeName?.[locale] ?? l.subRecipeName?.es ?? '?'}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">{l.qtyPerPortion}</td>
                <td className="py-2 text-xs text-muted-foreground">{l.unit}</td>
                <td className="py-2 text-right tabular-nums">
                  {l.productUnitCost == null ? '—' : formatCRC(l.productUnitCost)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatCRC(l.lineCostPerPortion)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {recipe.instructions && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              {t('instructions')}
            </p>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
              {recipe.instructions}
            </pre>
          </div>
        )}
      </CardContent>
    </>
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
