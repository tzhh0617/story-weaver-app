import type { FastifyInstance } from 'fastify';
import { validate } from '@story-weaver/shared/validation';
import { ModelSaveSchema } from '@story-weaver/shared/schemas/model-schemas';
import { ValidationError } from '@story-weaver/shared/errors';
import type { RuntimeServices } from '.././runtime/create-runtime-services.js';

export async function registerModelRoutes(
  app: FastifyInstance,
  services: RuntimeServices
) {
  app.get('/api/models', async () => services.listModelConfigs());

  app.put<{ Params: { modelId: string } }>(
    '/api/models/:modelId',
    async (request) => {
      const payload = validate(ModelSaveSchema, request.body);

      if (payload.id !== request.params.modelId) {
        throw new ValidationError([
          { field: 'id', reason: 'Model id does not match route' },
        ]);
      }

      services.modelConfigs.save(payload);
      return { ok: true };
    }
  );

  app.post<{ Params: { modelId: string } }>(
    '/api/models/:modelId/test',
    async (request) => services.testModel(request.params.modelId)
  );
}
