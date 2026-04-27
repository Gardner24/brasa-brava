import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // Cargar .env desde la raíz del monorepo en lugar de apps/web/
  envDir: path.resolve(__dirname, '../../'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@brasa/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
