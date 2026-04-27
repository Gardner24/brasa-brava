/**
 * Hooks de TanStack Query tipados para los endpoints del API.
 * Centralizan keys, fetchers y configuración de cache.
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type {
  ProductDTO,
  ProductDetailDTO,
  ListProductsQuery,
  CreateProductRequest,
  UpdateProductRequest,
  RecipeDTO,
  RecipeDetailDTO,
  ListRecipesQuery,
  CategoryDTO,
  AuditLogEntryDTO,
  ListAuditLogQuery,
  WarehouseDTO,
  StockLevelDTO,
  StockValuationByCategoryDTO,
  ListStockQuery,
  LowStockAlertDTO,
  ListAlertsQuery,
  StockMovementDTO,
  ListMovementsQuery,
  PurchaseMovementRequest,
  ConsumptionMovementRequest,
  WasteMovementRequest,
  TransferMovementRequest,
  AdjustmentMovementRequest,
} from '@brasa/shared-types';
import { api } from './api.ts';

// ===== Keys =====
export const qk = {
  products: (q?: Partial<ListProductsQuery>) => ['products', q ?? {}] as const,
  product: (id: string) => ['products', id] as const,
  productPriceHistory: (id: string) => ['products', id, 'price-history'] as const,
  recipes: (q?: Partial<ListRecipesQuery>) => ['recipes', q ?? {}] as const,
  recipe: (id: string) => ['recipes', id] as const,
  recipeScale: (id: string, n: number) => ['recipes', id, 'scale', n] as const,
  categories: () => ['categories'] as const,
  auditLog: (q?: Partial<ListAuditLogQuery>) => ['audit-log', q ?? {}] as const,
  warehouses: () => ['warehouses'] as const,
  stock: (q: ListStockQuery) => ['stock', q] as const,
  stockValuation: (warehouseId: string) => ['stock', 'valuation', warehouseId] as const,
  alerts: (q?: Partial<ListAlertsQuery>) => ['alerts', q ?? {}] as const,
  movements: (q?: Partial<ListMovementsQuery>) => ['movements', q ?? {}] as const,
};

// ===== Helpers =====
function qs(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

// ===== Products =====
export function useProducts(query: Partial<ListProductsQuery> = {}) {
  return useQuery({
    queryKey: qk.products(query),
    queryFn: () => api<Paginated<ProductDTO>>(`/products${qs(query)}`),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.product(id) : ['products', 'none'],
    queryFn: () => api<ProductDetailDTO>(`/products/${id}`),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductRequest) =>
      api<ProductDTO>('/products', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; body: UpdateProductRequest }) =>
      api<ProductDTO>(`/products/${args.id}`, {
        method: 'PATCH',
        body: JSON.stringify(args.body),
      }),
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: qk.product(args.id) });
    },
  });
}

// ===== Recipes =====
export function useRecipes(query: Partial<ListRecipesQuery> = {}) {
  return useQuery({
    queryKey: qk.recipes(query),
    queryFn: () => api<Paginated<RecipeDTO>>(`/recipes${qs(query)}`),
    placeholderData: keepPreviousData,
  });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.recipe(id) : ['recipes', 'none'],
    queryFn: () => api<RecipeDetailDTO>(`/recipes/${id}`),
    enabled: !!id,
  });
}

// ===== Categories =====
export function useCategories() {
  return useQuery({
    queryKey: qk.categories(),
    queryFn: () => api<CategoryDTO[]>('/categories'),
    staleTime: 5 * 60_000, // categorías cambian poco
  });
}

// ===== Audit log =====
export function useAuditLog(query: Partial<ListAuditLogQuery> = {}) {
  return useQuery({
    queryKey: qk.auditLog(query),
    queryFn: () => api<Paginated<AuditLogEntryDTO>>(`/audit-log${qs(query)}`),
    placeholderData: keepPreviousData,
  });
}

// ===== Warehouses =====
export function useWarehouses() {
  return useQuery({
    queryKey: qk.warehouses(),
    queryFn: () => api<WarehouseDTO[]>('/warehouses'),
    staleTime: 30_000,
  });
}

// ===== Stock =====
export function useStock(query: ListStockQuery | undefined) {
  return useQuery({
    queryKey: query ? qk.stock(query) : ['stock', 'none'],
    queryFn: () => api<StockLevelDTO[]>(`/stock${qs(query!)}`),
    enabled: !!query?.warehouseId,
    placeholderData: keepPreviousData,
  });
}

export function useStockValuation(warehouseId: string | undefined) {
  return useQuery({
    queryKey: warehouseId ? qk.stockValuation(warehouseId) : ['stock', 'valuation', 'none'],
    queryFn: () => api<StockValuationByCategoryDTO>(`/stock/valuation?warehouseId=${warehouseId}`),
    enabled: !!warehouseId,
  });
}

// ===== Alerts =====
export function useAlerts(query: Partial<ListAlertsQuery> = {}) {
  return useQuery({
    queryKey: qk.alerts(query),
    queryFn: () => api<Paginated<LowStockAlertDTO>>(`/alerts${qs(query)}`),
    placeholderData: keepPreviousData,
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; notes?: string }) =>
      api<void>(`/alerts/${args.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ notes: args.notes ?? '' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

// ===== Movements =====
export function useMovements(query: Partial<ListMovementsQuery> = {}) {
  return useQuery({
    queryKey: qk.movements(query),
    queryFn: () => api<Paginated<StockMovementDTO>>(`/movements${qs(query)}`),
    placeholderData: keepPreviousData,
  });
}

function invalidateAfterMovement(qc: ReturnType<typeof useQueryClient>): void {
  qc.invalidateQueries({ queryKey: ['stock'] });
  qc.invalidateQueries({ queryKey: ['warehouses'] });
  qc.invalidateQueries({ queryKey: ['movements'] });
  qc.invalidateQueries({ queryKey: ['alerts'] });
  qc.invalidateQueries({ queryKey: ['products'] });
}

export function useRegisterPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PurchaseMovementRequest) =>
      api<StockMovementDTO>('/movements/purchase', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAfterMovement(qc),
  });
}

export function useRegisterConsumption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ConsumptionMovementRequest) =>
      api<StockMovementDTO>('/movements/consumption', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAfterMovement(qc),
  });
}

export function useRegisterWaste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WasteMovementRequest) =>
      api<StockMovementDTO>('/movements/waste', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAfterMovement(qc),
  });
}

export function useRegisterTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransferMovementRequest) =>
      api<{ outMovement: StockMovementDTO; inMovement: StockMovementDTO }>(
        '/movements/transfer',
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => invalidateAfterMovement(qc),
  });
}

export function useRegisterAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdjustmentMovementRequest) =>
      api<StockMovementDTO>('/movements/adjustment', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAfterMovement(qc),
  });
}
