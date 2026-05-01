import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  base: './',
  root: path.resolve(__dirname, 'src'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: '@story-weaver/shared/contracts',
        replacement: path.resolve(__dirname, '../shared/src/contracts.ts'),
      },
      {
        find: '@story-weaver/shared/settings',
        replacement: path.resolve(__dirname, '../shared/src/settings.ts'),
      },
      {
        find: '@story-weaver/shared',
        replacement: path.resolve(__dirname, '../shared/src/index.ts'),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, 'src'),
      },
    ],
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5174',
    },
  },
});
