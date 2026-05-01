import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { resolveServerConfig } from '@story-weaver/backend/config';

describe('resolveServerConfig', () => {
  it('uses local defaults when no environment overrides are provided', () => {
    expect(resolveServerConfig({})).toEqual({
      host: '127.0.0.1',
      port: 5174,
      rootDir: path.join(os.homedir(), '.story-weaver'),
      staticDir: path.resolve('dist'),
    });
  });

  it('resolves explicit environment overrides', () => {
    expect(
      resolveServerConfig({
        STORY_WEAVER_SERVER_HOST: '0.0.0.0',
        STORY_WEAVER_SERVER_PORT: '6184',
        STORY_WEAVER_ROOT_DIR: '/tmp/story-weaver-data',
        STORY_WEAVER_STATIC_DIR: '/tmp/story-weaver-dist',
      })
    ).toEqual({
      host: '0.0.0.0',
      port: 6184,
      rootDir: '/tmp/story-weaver-data',
      staticDir: '/tmp/story-weaver-dist',
    });
  });

  it('falls back to the default port when the port override is invalid', () => {
    expect(
      resolveServerConfig({
        STORY_WEAVER_SERVER_PORT: 'not-a-port',
      }).port
    ).toBe(5174);
  });
});
