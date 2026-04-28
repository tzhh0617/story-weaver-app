import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'renderer'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: path.resolve(__dirname, 'tests/setup.ts'),
  },
});
