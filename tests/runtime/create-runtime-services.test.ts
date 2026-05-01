import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRuntimeServices } from '@story-weaver/backend/runtime/create-runtime-services';

describe('createRuntimeServices', () => {
  it('boots against an isolated root directory with real repositories', () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-runtime-'));

    try {
      const services = createRuntimeServices({ rootDir });

      services.settings.set('runtime.test', 'ok');

      expect(services.bookService.listBooks()).toEqual([]);
      expect(services.settings.get('runtime.test')).toBe('ok');
      services.close();
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('closes the underlying database connection idempotently', () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-runtime-'));

    try {
      const services = createRuntimeServices({ rootDir });

      services.close();
      expect(() => services.close()).not.toThrow();
      expect(() => services.bookService.listBooks()).toThrow();
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('keeps shared runtime composition independent from electron modules', () => {
    const runtimeSource = readFileSync(
      path.resolve('packages/backend/src/runtime/create-runtime-services.ts'),
      'utf8'
    );

    expect(runtimeSource).not.toContain('../../electron');
    expect(runtimeSource).not.toContain('../electron');
  });
});
