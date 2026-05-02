import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { AddressInfo } from 'node:net';
import { AppError } from '@story-weaver/shared/errors';
import { createRuntimeServices } from './runtime/create-runtime-services.js';
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
  const staticDir = options?.staticDir ?? config.staticDir;
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const services = (options?.createRuntime ?? createRuntimeServices)({
    rootDir: options?.rootDir ?? config.rootDir,
  });
  const exportsRegistry = createExportRegistry();

  app.addHook('onClose', async () => {
    services.close();
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.toJSON() });
    }

    if (typeof error === 'object' && error !== null && 'validation' in error) {
      const message = error instanceof Error ? error.message : 'Validation error';
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message,
        },
      });
    }

    reply.log.error(error);
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  });

  const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';

  await app.register(cors, {
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    origin: isDev
      ? ['http://localhost:5173', 'http://127.0.0.1:5173']
      : [],
  });
  await registerHealthRoutes(app);
  await registerBookRoutes(app, services, { exportsRegistry });
  await registerSchedulerRoutes(app, services);
  await registerModelRoutes(app, services);
  await registerSettingsRoutes(app, services);
  await registerEventRoutes(app, services);
  await registerExportRoutes(app, exportsRegistry);
  await registerStaticRoutes(app, { staticDir });

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
