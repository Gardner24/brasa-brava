import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar.tsx';
import { Topbar } from './Topbar.tsx';

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
