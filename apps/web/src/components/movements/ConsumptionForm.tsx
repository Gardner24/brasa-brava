import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { ConsumptionMovementRequest } from '@brasa/shared-types';
import { Input } from '@/components/ui/input.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import { FormField } from '@/components/forms/FormField.tsx';
import { useZodForm } from '@/lib/use-zod-form.ts';
import { useProducts, useWarehouses, useRegisterConsumption } from '@/lib/queries.ts';
import { ApiError } from '@/lib/api.ts';
import { useServerError } from './use-server-error.ts';

interface Props {
  onSuccess: () => void;
  defaultProductId?: string;
  defaultWarehouseId?: string;
}

export function ConsumptionForm({ onSuccess, defaultProductId, defaultWarehouseId }: Props) {
  const { t, i18n } = useTranslation('movements');
  const { t: tc } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'es') as 'es' | 'en';

  const products = useProducts({ pageSize: 200, isActive: true });
  const warehouses = useWarehouses();
  const mutation = useRegisterConsumption();
  const { serverError, captureServerError, clearServerError } = useServerError();

  const form = useZodForm(ConsumptionMovementRequest, {
    defaultValues: {
      productId: defaultProductId ?? '',
      warehouseId: defaultWarehouseId ?? '',
      qty: undefined as unknown as number,
      notes: '',
    },
  });

  const onSubmit = async (values: ConsumptionMovementRequest): Promise<void> => {
    clearServerError();
    try {
      const payload: ConsumptionMovementRequest = { ...values };
      if (!payload.notes) delete (payload as { notes?: string }).notes;
      await mutation.mutateAsync(payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        captureServerError(tc(`errors.${err.body.code}`, tc('errors.INTERNAL')));
      } else {
        captureServerError(tc('errors.INTERNAL'));
      }
    }
  };

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField
        label={t('fields.product')}
        htmlFor="cons-product"
        error={errors.productId?.message}
        required
      >
        <Select id="cons-product" {...form.register('productId')}>
          <option value="">{t('fields.selectProduct')}</option>
          {products.data?.data.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name[locale] ?? p.name.es} ({p.baseUnit})
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label={t('fields.warehouse')}
        htmlFor="cons-warehouse"
        error={errors.warehouseId?.message}
        required
      >
        <Select id="cons-warehouse" {...form.register('warehouseId')}>
          <option value="">{t('fields.selectWarehouse')}</option>
          {warehouses.data?.filter((w) => w.isActive).map((w) => (
            <option key={w.id} value={w.id}>
              {w.displayName} ({w.code})
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label={t('fields.qty')}
        htmlFor="cons-qty"
        error={errors.qty?.message}
        required
        hint="qty positiva — el sistema descuenta del stock"
      >
        <Input
          id="cons-qty"
          type="number"
          step="any"
          min="0"
          {...form.register('qty', { valueAsNumber: true })}
        />
      </FormField>

      <FormField label={t('fields.notes')} htmlFor="cons-notes" error={errors.notes?.message}>
        <Input id="cons-notes" type="text" maxLength={500} {...form.register('notes')} />
      </FormField>

      {serverError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          className="bg-ember text-cream hover:bg-ember/90"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? <Spinner /> : t('actions.submit')}
        </Button>
      </div>
    </form>
  );
}
