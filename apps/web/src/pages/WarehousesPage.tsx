import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Warehouse, Package, BellRing, ArrowRight, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useWarehouses } from '@/lib/queries.ts';

export function WarehousesPage() {
  const { t } = useTranslation('inventory');
  const navigate = useNavigate();
  const warehouses = useWarehouses();

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">{t('warehouses.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('warehouses.subtitle')}</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('warehouses.newWarehouse')}
        </Button>
      </header>

      {warehouses.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 py-5">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : warehouses.data && warehouses.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {warehouses.data.map((w) => (
            <Card
              key={w.id}
              className="group cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/inventory?warehouseId=${w.id}`)}
            >
              <CardContent className="space-y-4 py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-brand" />
                      <h2 className="font-display text-lg leading-tight">{w.displayName}</h2>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{w.code}</p>
                  </div>
                  {!w.isActive && (
                    <Badge variant="outline">{t('warehouses.inactive')}</Badge>
                  )}
                </div>

                <dl className="grid grid-cols-3 gap-3 border-y border-border/50 py-3 text-xs">
                  <Metric
                    icon={<Package className="h-3 w-3" />}
                    label={t('warehouses.card.items')}
                    value={String(w.itemsCount)}
                  />
                  <Metric
                    label={t('warehouses.card.value')}
                    value={formatCRC(w.totalValueCRC)}
                  />
                  <Metric
                    icon={<BellRing className="h-3 w-3" />}
                    label={t('warehouses.card.openAlerts')}
                    value={String(w.openAlertsCount)}
                    accent={w.openAlertsCount > 0 ? 'warning' : undefined}
                  />
                </dl>

                <div className="flex items-center justify-end text-sm text-brand opacity-0 transition-opacity group-hover:opacity-100">
                  {t('warehouses.card.viewInventory')}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('warehouses.empty')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface MetricProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
  accent?: 'warning';
}

function Metric({ icon, label, value, accent }: MetricProps) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd
        className={
          accent === 'warning'
            ? 'mt-0.5 font-display text-base text-warning'
            : 'mt-0.5 font-display text-base'
        }
      >
        {value}
      </dd>
    </div>
  );
}

function formatCRC(n: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}
