import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { TransferMovementRequest } from '@brasa/shared-types';
import { Input } from '@/components/ui/input.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import { FormField } from '@/components/forms/FormField.tsx';
import { useZodForm } from '@/lib/use-zod-form.ts';
import { useProducts, useWarehouses, useRegisterTransfer } from '@/lib/queries.ts';
import { ApiError } from '@/lib/api.ts';
import { useServerError } from './use-server-error.ts';

interface Props {
  onSuccess: () => void;
  defaultProductId?: string;
  defaultFromWarehouseId?: string;
}

export function TransferForm({ onSuccess, defaultProductId, defaultFromWarehouseId }: Props) {
  const { t, i18n } = useTranslation('movements');
  const { t: tc } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'es') as 'es' | 'en';

  const products = useProducts({ pageSize: 200, isActive: true });
  const warehouses = useWarehouses();
  const mutation = useRegisterTransfer();
  const { serverError, captureServerError, clearServerError } = useServerError();

  const form = useZodForm(TransferMovementRequest, {
    defaultValues: {
      productId: defaultProductId ?? '',
      fromWarehouseId: defaultFromWarehouseId ?? '',
      toWarehouseId: '',
      qty: undefined as unknown as number,
      notes: '',
    },
  });

  const fromId = form.watch('fromWarehouseId');
  const toId = form.watch('toWarehouseId');
  const sameWarehouse = !!fromId && !!toId && fromId === toId;

  const onSubmit = async (values: TransferMovementRequest): Promise<void> => {
    clearServerError();
    if (values.fromWarehouseId === values.toWarehouseId) {
      captureServerError(t('transferSameWarehouse'));
      return;
    }
    try {
      const payload: TransferMovementRequest = { ...values };
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
  const activeWarehouses = warehouses.data?.filter((w) => w.isActive) ?? [];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField
        label={t('fields.product')}
        htmlFor="xfer-product"
        error={errors.productId?.message}
        required
      >
        <Select id="xfer-product" {...form.register('productId')}>
          <option value="">{t('fields.selectProduct')}</option>
          {products.data?.data.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name[locale] ?? p.name.es} ({p.baseUnit})
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label={t('fields.fromWarehouse')}
          htmlFor="xfer-from"
          error={errors.fromWarehouseId?.message}
          required
        >
          <Select id="xfer-from" {...form.register('fromWarehouseId')}>
            <option value="">{t('fields.selectWarehouse')}</option>
            {activeWarehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.displayName} ({w.code})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label={t('fields.toWarehouse')}
          htmlFor="xfer-to"
          error={errors.toWarehouseId?.message}
          required
        >
          <Select id="xfer-to" {...form.register('toWarehouseId')}>
            <option value="">{t('fields.selectWarehouse')}</option>
            {activeWarehouses.map((w) => (
              <option key={w.id} value={w.id} disabled={w.id === fromId}>
                {w.displayName} ({w.code})
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {sameWarehouse && (
        <p className="text-xs text-destructive">{t('transferSameWarehouse')}</p>
      )}

      <FormField
        label={t('fields.qty')}
        htmlFor="xfer-qty"
        error={errors.qty?.message}
        required
      >
        <Input
          id="xfer-qty"
          type="number"
          step="any"
          min="0"
          {...form.register('qty', { valueAsNumber: true })}
        />
      </FormField>

      <FormField label={t('fields.notes')} htmlFor="xfer-notes" error={errors.notes?.message}>
        <Input id="xfer-notes" type="text" maxLength={500} {...form.register('notes')} />
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
          disabled={form.formState.isSubmitting || sameWarehouse}
        >
          {form.formState.isSubmitting ? <Spinner /> : t('actions.submit')}
        </Button>
      </div>
    </form>
  );
}
