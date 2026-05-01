import type { FastifyInstance } from 'fastify';
import { SHORT_CHAPTER_REVIEW_ENABLED_KEY } from '../core/chapter-review.js';
import type { RuntimeServices } from '.././runtime/create-runtime-services.js';

function readValue(body: unknown) {
  if (
    body &&
    typeof body === 'object' &&
    'value' in body &&
    typeof body.value === 'string'
  ) {
    return body.value;
  }

  return null;
}

function validateSetting(key: string, value: string) {
  if (key === 'scheduler.concurrencyLimit') {
    const trimmed = value.trim();

    if (trimmed && (!/^\d+$/.test(trimmed) || Number(trimmed) < 1)) {
      return 'Concurrency limit must be a positive integer';
    }
  }

  if (
    key === SHORT_CHAPTER_REVIEW_ENABLED_KEY &&
    !['true', 'false'].includes(value)
  ) {
    return 'Short chapter review setting must be true or false';
  }

  return null;
}

export async function registerSettingsRoutes(
  app: FastifyInstance,
  services: RuntimeServices
) {
  app.get('/api/settings', async () =>
    Object.entries(services.settings.list()).map(([key, value]) => ({
      key,
      value,
    }))
  );

  app.get<{ Params: { key: string } }>(
    '/api/settings/:key',
    async (request) => ({
      key: request.params.key,
      value: services.settings.get(request.params.key),
    })
  );

  app.put<{ Params: { key: string } }>(
    '/api/settings/:key',
    async (request, reply) => {
      const value = readValue(request.body);

      if (value === null) {
        return reply.status(400).send({ error: 'Invalid setting payload' });
      }

      const validationError = validateSetting(request.params.key, value);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      services.settings.set(request.params.key, value);

      if (request.params.key === 'scheduler.concurrencyLimit') {
        const trimmed = value.trim();
        services.setSchedulerConcurrencyLimit(trimmed ? Number(trimmed) : null);
      }

      return { ok: true };
    }
  );
}
