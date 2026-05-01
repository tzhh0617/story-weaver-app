import { describe, expect, it } from 'vitest';
import { createExportRegistry } from '@story-weaver/backend/export-registry';

describe('export registry TTL', () => {
  it('expires entries older than 30 minutes', () => {
    const registry = createExportRegistry();
    const download = registry.register('/tmp/test.txt');
    expect(registry.get(download.id)).toBeTruthy();

    // Access internal map to backdate entry
    const internal = (registry as any)._exportsById as Map<string, any>;
    const entry = internal.get(download.id);
    entry.createdAt = Date.now() - 31 * 60 * 1000;

    expect(registry.get(download.id)).toBeNull();
  });

  it('rejects registration when at capacity', () => {
    const registry = createExportRegistry();

    for (let i = 0; i < 50; i++) {
      registry.register(`/tmp/file-${i}.txt`);
    }

    expect(() => registry.register('/tmp/overflow.txt')).toThrow();
  });
});
