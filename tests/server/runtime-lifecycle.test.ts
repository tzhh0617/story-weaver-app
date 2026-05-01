import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '../../server/main';
import { createRuntimeServices } from '../../src/runtime/create-runtime-services';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-lifecycle-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server runtime lifecycle', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('closes the shared runtime when the Fastify server closes', async () => {
    const close = vi.fn();
    const server = await buildServer({
      rootDir: makeRootDir(),
      createRuntime: (input) => ({
        ...createRuntimeServices(input),
        close,
      }),
    });

    await server.close();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
