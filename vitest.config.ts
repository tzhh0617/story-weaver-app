import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: path.resolve(__dirname, 'tests/setup.ts'),
  },
});
