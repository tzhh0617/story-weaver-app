import type { FastifyInstance } from 'fastify';
import type { RuntimeServices } from '../../src/runtime/create-runtime-services.js';

export async function registerSchedulerRoutes(
  app: FastifyInstance,
  services: RuntimeServices
) {
  app.get('/api/scheduler/status', async () => services.getSchedulerStatus());

  app.post('/api/scheduler/start', async () => {
    await services.startAllBooks();
    return { ok: true };
  });

  app.post('/api/scheduler/pause', async () => {
    await services.pauseAllBooks();
    return { ok: true };
  });
}
