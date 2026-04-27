import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { X, ShoppingCart, Utensils, Trash2, ArrowLeftRight, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn.ts';
import { PurchaseForm } from './PurchaseForm.tsx';
import { ConsumptionForm } from './ConsumptionForm.tsx';
import { WasteForm } from './WasteForm.tsx';
import { TransferForm } from './TransferForm.tsx';
import { AdjustmentForm } from './AdjustmentForm.tsx';

export type MovementTab = 'purchase' | 'consumption' | 'waste' | 'transfer' | 'adjustment';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selecciona producto/almacén cuando se abre desde InventoryPage */
  defaultProductId?: string;
  defaultWarehouseId?: string;
  initialTab?: MovementTab;
}

export function RegisterMovementDrawer({
  open,
  onOpenChange,
  defaultProductId,
  defaultWarehouseId,
  initialTab = 'purchase',
}: Props) {
  const { t } = useTranslation('movements');
  const [tab, setTab] = useState<MovementTab>(initialTab);

  const close = (): void => onOpenChange(false);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l bg-background shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
        >
          <header className="flex items-start justify-between border-b px-6 py-4">
            <div>
              <Dialog.Title className="font-display text-xl">
                {t('registerTitle')}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                {t('registerSub')}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </header>

          <nav className="flex shrink-0 gap-1 border-b bg-muted/30 px-2 py-1.5">
            <TabButton
              active={tab === 'purchase'}
              onClick={() => setTab('purchase')}
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              label={t('tabs.purchase')}
            />
            <TabButton
              active={tab === 'consumption'}
              onClick={() => setTab('consumption')}
              icon={<Utensils className="h-3.5 w-3.5" />}
              label={t('tabs.consumption')}
            />
            <TabButton
              active={tab === 'waste'}
              onClick={() => setTab('waste')}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              label={t('tabs.waste')}
            />
            <TabButton
              active={tab === 'transfer'}
              onClick={() => setTab('transfer')}
              icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
              label={t('tabs.transfer')}
            />
            <TabButton
              active={tab === 'adjustment'}
              onClick={() => setTab('adjustment')}
              icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              label={t('tabs.adjustment')}
            />
          </nav>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === 'purchase' && (
              <PurchaseForm
                onSuccess={close}
                defaultProductId={defaultProductId}
                defaultWarehouseId={defaultWarehouseId}
              />
            )}
            {tab === 'consumption' && (
              <ConsumptionForm
                onSuccess={close}
                defaultProductId={defaultProductId}
                defaultWarehouseId={defaultWarehouseId}
              />
            )}
            {tab === 'waste' && (
              <WasteForm
                onSuccess={close}
                defaultProductId={defaultProductId}
                defaultWarehouseId={defaultWarehouseId}
              />
            )}
            {tab === 'transfer' && (
              <TransferForm
                onSuccess={close}
                defaultProductId={defaultProductId}
                defaultFromWarehouseId={defaultWarehouseId}
              />
            )}
            {tab === 'adjustment' && (
              <AdjustmentForm
                onSuccess={close}
                defaultProductId={defaultProductId}
                defaultWarehouseId={defaultWarehouseId}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
