import type { FastifyInstance } from 'fastify';
import type { ModelSavePayload } from '@story-weaver/shared/contracts';
import type { RuntimeServices } from '.././runtime/create-runtime-services.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isModelSavePayload(value: unknown): value is ModelSavePayload {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.provider === 'openai' || value.provider === 'anthropic') &&
    typeof value.modelName === 'string' &&
    typeof value.apiKey === 'string' &&
    typeof value.baseUrl === 'string' &&
    isRecord(value.config)
  );
}

export async function registerModelRoutes(
  app: FastifyInstance,
  services: RuntimeServices
) {
  app.get('/api/models', async () => services.listModelConfigs());

  app.put<{ Params: { modelId: string } }>(
    '/api/models/:modelId',
    async (request, reply) => {
      if (!isModelSavePayload(request.body)) {
        return reply.status(400).send({ error: 'Invalid model payload' });
      }

      if (request.body.id !== request.params.modelId) {
        return reply.status(400).send({ error: 'Model id does not match route' });
      }

      services.modelConfigs.save(request.body);
      return { ok: true };
    }
  );

  app.post<{ Params: { modelId: string } }>(
    '/api/models/:modelId/test',
    async (request) => services.testModel(request.params.modelId)
  );
}
