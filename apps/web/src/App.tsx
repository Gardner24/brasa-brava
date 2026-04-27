import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth-context.tsx';
import { AppShell } from '@/components/layout/AppShell.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import { LoginPage } from '@/pages/LoginPage.tsx';
import { Dashboard } from '@/pages/Dashboard.tsx';
import { CatalogPage } from '@/pages/CatalogPage.tsx';
import { RecipesPage } from '@/pages/RecipesPage.tsx';
import { AuditLogPage } from '@/pages/AuditLogPage.tsx';
import { WarehousesPage } from '@/pages/WarehousesPage.tsx';
import { InventoryPage } from '@/pages/InventoryPage.tsx';
import { MovementsPage } from '@/pages/MovementsPage.tsx';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedShell />}>
            <Route path="/" element={<Navigate to="/catalog" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/warehouses" element={<WarehousesPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/movements" element={<MovementsPage />} />
            <Route path="/admin/audit-log" element={<AuditLogPage />} />
            <Route path="*" element={<Navigate to="/catalog" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function ProtectedShell() {
  const { status } = useAuth();
  const loc = useLocation();

  if (status === 'idle') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
