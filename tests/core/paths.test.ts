import { describe, expect, it } from 'vitest';
import { buildAppPaths } from '@story-weaver/backend/shared/paths';

describe('buildAppPaths', () => {
  it('builds stable data, export, and log paths under the app root', () => {
    const paths = buildAppPaths('/tmp/story-weaver');

    expect(paths.databaseFile).toBe('/tmp/story-weaver/data.db');
    expect(paths.exportDir).toBe('/tmp/story-weaver/exports');
    expect(paths.logDir).toBe('/tmp/story-weaver/logs');
  });
});
