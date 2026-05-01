import cors from '@fastify/cors';
import Fastify from 'fastify';
import { createRuntimeServices } from '../src/runtime/create-runtime-services.js';
import { resolveServerConfig } from './config.js';
import { createExportRegistry } from './export-registry.js';
import { registerBookRoutes } from './routes/books.js';
import { registerEventRoutes } from './routes/events.js';
import { registerExportRoutes } from './routes/exports.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerInvokeRoutes } from './routes/invoke.js';
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
  await registerInvokeRoutes(app, services, { exportsRegistry });
  await registerEventRoutes(app, services);
  await registerExportRoutes(app, exportsRegistry);
  await registerStaticRoutes(app, {
    staticDir: options?.staticDir ?? config.staticDir,
  });

  return app;
}

async function main() {
  const { host, port } = resolveServerConfig();
  const app = await buildServer();

  await app.listen({ host, port });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
