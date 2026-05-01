import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { AddressInfo } from 'node:net';
import { createRuntimeServices } from '../src/runtime/create-runtime-services.js';
import { resolveServerConfig } from './config.js';
import { createExportRegistry } from './export-registry.js';
import { registerBookRoutes } from './routes/books.js';
import { registerEventRoutes } from './routes/events.js';
import { registerExportRoutes } from './routes/exports.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerModelRoutes } from './routes/models.js';
import { registerSchedulerRoutes } from './routes/scheduler.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerStaticRoutes } from './routes/static.js';

export async function buildServer(options?: {
  rootDir?: string;
  staticDir?: string;
  createRuntime?: typeof createRuntimeServices;
}) {
  const config = resolveServerConfig();
  const app = Fastify({ logger: false });
  const services = (options?.createRuntime ?? createRuntimeServices)({
    rootDir: options?.rootDir ?? config.rootDir,
  });
  const exportsRegistry = createExportRegistry();

  app.addHook('onClose', async () => {
    services.close();
  });

  await app.register(cors, {
    origin: true,
  });
  await registerHealthRoutes(app);
  await registerBookRoutes(app, services, { exportsRegistry });
  await registerSchedulerRoutes(app, services);
  await registerModelRoutes(app, services);
  await registerSettingsRoutes(app, services);
  await registerEventRoutes(app, services);
  await registerExportRoutes(app, exportsRegistry);
  await registerStaticRoutes(app, {
    staticDir: options?.staticDir ?? config.staticDir,
  });

  return app;
}

export async function startServer(options?: {
  rootDir?: string;
  staticDir?: string;
  host?: string;
  port?: number;
}) {
  const config = resolveServerConfig();
  const host = options?.host ?? config.host;
  const port = options?.port ?? config.port;
  const app = await buildServer({
    rootDir: options?.rootDir ?? config.rootDir,
    staticDir: options?.staticDir ?? config.staticDir,
  });

  await app.listen({ host, port });
  const address = app.server.address() as AddressInfo | string | null;
  const boundPort =
    address && typeof address === 'object' ? address.port : port;

  return {
    app,
    url: `http://${host}:${boundPort}`,
  };
}

async function main() {
  await startServer();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
