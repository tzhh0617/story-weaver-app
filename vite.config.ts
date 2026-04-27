/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import type { InlineConfig } from 'vitest/node';
import { defineConfig } from 'vite';

const config = {
  root: 'renderer',
  plugins: [
    react(),
    electron([
      { entry: 'electron/main.ts' },
      { entry: 'electron/preload.ts', onstart: ({ reload }) => reload() },
    ]),
    renderer(),
  ],
  test: {
    root: '.',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
} satisfies Parameters<typeof defineConfig>[0] & { test: InlineConfig };

export default defineConfig(config);
