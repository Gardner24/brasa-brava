import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, BellRing, CheckCircle2, RefreshCcw } from 'lucide-react';
import type { LowStockAlertDTO } from '@brasa/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import { useAlerts, useResolveAlert, useWarehouses } from '@/lib/queries.ts';
import { ApiError } from '@/lib/api.ts';

export function AlertsPage() {
  const { t, i18n } = useTranslation('alerts');
  const { t: tc } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'es') as 'es' | 'en';

  const [warehouseId, setWarehouseId] = useState<string>('');
  const [showResolved, setShowResolved] = useState(false);

  const warehouses = useWarehouses();

  const query = useMemo(
    () => ({
      ...(warehouseId ? { warehouseId } : {}),
      ...(showResolved ? { resolved: true } : { resolved: false }),
      page: 1,
      pageSize: 100,
    }),
    [warehouseId, showResolved],
  );

  const alerts = useAlerts(query);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => alerts.refetch()}
          disabled={alerts.isFetching}
        >
          <RefreshCcw className="mr-1 h-3 w-3" />
          {tc('actions.refresh')}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('filters.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('filters.warehouse')}
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{t('filters.allWarehouses')}</option>
              {warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.displayName} ({w.code})
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 self-end rounded-md border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
            />
            {t('filters.showResolved')}
          </label>
        </CardContent>
      </Card>

      {alerts.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 py-5">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : alerts.data && alerts.data.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {alerts.data.data.map((a) => (
            <AlertCard key={a.id} alert={a} locale={locale} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <p className="text-sm text-muted-foreground">
              {showResolved ? t('empty.all') : t('empty.open')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface AlertCardProps {
  alert: LowStockAlertDTO;
  locale: 'es' | 'en';
}

function AlertCard({ alert, locale }: AlertCardProps) {
  const { t } = useTranslation('alerts');
  const { t: tc } = useTranslation();
  const resolved = alert.resolvedAt != null;
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useResolveAlert();

  const diff = alert.reorderPoint - alert.qtyOnHandNow;

  const onConfirm = async (): Promise<void> => {
    setError(null);
    try {
      await mutation.mutateAsync({ id: alert.id, notes: notes || undefined });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(tc(`errors.${err.body.code}`, tc('errors.INTERNAL')));
      } else {
        setError(tc('errors.INTERNAL'));
      }
    }
  };

  return (
    <Card
      className={
        resolved
          ? 'border-border/40 opacity-70'
          : 'border-warning/30 shadow-[0_0_0_1px_hsl(var(--warning)/0.15)]'
      }
    >
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {resolved ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
            ) : (
              <BellRing className="mt-0.5 h-4 w-4 text-warning" />
            )}
            <div>
              <p className="font-medium">{alert.productName[locale] ?? alert.productName.es}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {alert.productSku} · {alert.warehouseCode}
              </p>
            </div>
          </div>
          {resolved ? (
            <Badge variant="success">{t('card.resolved')}</Badge>
          ) : (
            <Badge variant="warning">{t('card.openSince')} {formatRel(alert.raisedAt, locale)}</Badge>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-2 border-y border-border/50 py-2 text-xs">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('card.atRaise')}
            </dt>
            <dd className="font-display text-sm tabular-nums">
              {formatNumber(alert.qtyOnHandAtRaise)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('card.now')}
            </dt>
            <dd
              className={
                alert.qtyOnHandNow < alert.reorderPoint
                  ? 'font-display text-sm tabular-nums text-warning'
                  : 'font-display text-sm tabular-nums text-success'
              }
            >
              {formatNumber(alert.qtyOnHandNow)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('card.reorderPoint')}
            </dt>
            <dd className="font-display text-sm tabular-nums">
              {formatNumber(alert.reorderPoint)}
            </dd>
          </div>
        </dl>

        {!resolved && diff > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('card.diff')}: <span className="font-display text-warning">{formatNumber(diff)}</span>
          </p>
        )}

        {!resolved && (
          <>
            {!showResolveForm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResolveForm(true)}
                className="w-full"
              >
                {t('card.resolveCta')}
              </Button>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground" htmlFor={`notes-${alert.id}`}>
                  {t('card.notesLabel')}
                </label>
                <Input
                  id={`notes-${alert.id}`}
                  type="text"
                  maxLength={500}
                  placeholder={t('card.notesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowResolveForm(false);
                      setNotes('');
                    }}
                  >
                    {tc('actions.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={onConfirm}
                    disabled={mutation.isPending}
                    className="bg-ember text-cream hover:bg-ember/90"
                  >
                    {mutation.isPending ? <Spinner /> : t('card.confirmResolve')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {resolved && alert.resolvedAt && (
          <p className="text-xs text-muted-foreground">
            {t('card.resolvedAt')}: {formatDate(alert.resolvedAt, locale)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-CR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string, locale: 'es' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-CR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function formatRel(iso: string, locale: 'es' | 'en'): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale === 'es' ? 'es-CR' : 'en-US', { numeric: 'auto' });
  if (min < 60) return rtf.format(-min, 'minute');
  const hr = Math.round(min / 60);
  if (hr < 24) return rtf.format(-hr, 'hour');
  const day = Math.round(hr / 24);
  return rtf.format(-day, 'day');
}
