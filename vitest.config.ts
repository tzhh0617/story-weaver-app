import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@story-weaver/shared/contracts',
        replacement: path.resolve(__dirname, 'packages/shared/src/contracts.ts'),
      },
      {
        find: '@story-weaver/shared/settings',
        replacement: path.resolve(__dirname, 'packages/shared/src/settings.ts'),
      },
      {
        find: '@story-weaver/shared',
        replacement: path.resolve(__dirname, 'packages/shared/src/index.ts'),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, 'renderer'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: path.resolve(__dirname, 'tests/setup.ts'),
  },
});
