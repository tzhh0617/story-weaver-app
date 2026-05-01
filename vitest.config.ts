import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@story-weaver\/frontend\/(.*)$/,
        replacement: path.resolve(__dirname, 'packages/frontend/src/$1'),
      },
      {
        find: /^@story-weaver\/backend\/(.*)$/,
        replacement: path.resolve(__dirname, 'packages/backend/src/$1'),
      },
      {
        find: '@story-weaver/backend',
        replacement: path.resolve(__dirname, 'packages/backend/src/index.ts'),
      },
      {
        find: '@story-weaver/shared/contracts',
        replacement: path.resolve(__dirname, 'packages/shared/src/contracts.ts'),
      },
      {
        find: '@story-weaver/shared/settings',
        replacement: path.resolve(__dirname, 'packages/shared/src/settings.ts'),
      },
      {
        find: '@story-weaver/shared/errors',
        replacement: path.resolve(__dirname, 'packages/shared/src/errors.ts'),
      },
      {
        find: '@story-weaver/shared/validation',
        replacement: path.resolve(__dirname, 'packages/shared/src/validation.ts'),
      },
      {
        find: '@story-weaver/shared/schemas/book-schemas',
        replacement: path.resolve(__dirname, 'packages/shared/src/schemas/book-schemas.ts'),
      },
      {
        find: '@story-weaver/shared/schemas/model-schemas',
        replacement: path.resolve(__dirname, 'packages/shared/src/schemas/model-schemas.ts'),
      },
      {
        find: '@story-weaver/shared/schemas/settings-schemas',
        replacement: path.resolve(__dirname, 'packages/shared/src/schemas/settings-schemas.ts'),
      },
      {
        find: '@story-weaver/shared/schemas/event-schemas',
        replacement: path.resolve(__dirname, 'packages/shared/src/schemas/event-schemas.ts'),
      },
      {
        find: '@story-weaver/shared',
        replacement: path.resolve(__dirname, 'packages/shared/src/index.ts'),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, 'packages/frontend/src'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: path.resolve(__dirname, 'tests/setup.ts'),
  },
});
