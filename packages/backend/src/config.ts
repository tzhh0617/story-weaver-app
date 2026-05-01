import os from 'node:os';
import path from 'node:path';

export type ServerConfig = {
  host: string;
  port: number;
  rootDir: string;
  staticDir: string;
};

function parsePort(value: string | undefined) {
  if (!value) {
    return 5174;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return 5174;
  }

  return parsed;
}

export function resolveServerConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env
): ServerConfig {
  return {
    host: env.STORY_WEAVER_SERVER_HOST || '127.0.0.1',
    port: parsePort(env.STORY_WEAVER_SERVER_PORT),
    rootDir: env.STORY_WEAVER_ROOT_DIR || path.join(os.homedir(), '.story-weaver'),
    staticDir: env.STORY_WEAVER_STATIC_DIR || path.resolve('dist'),
  };
}
