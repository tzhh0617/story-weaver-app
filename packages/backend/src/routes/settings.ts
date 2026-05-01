import type { FastifyInstance } from 'fastify';
import { validate } from '@story-weaver/shared/validation';
import { SettingUpdateSchema } from '@story-weaver/shared/schemas/settings-schemas';
import { ValidationError } from '@story-weaver/shared/errors';
import { SHORT_CHAPTER_REVIEW_ENABLED_KEY } from '../core/chapter-review.js';
import type { RuntimeServices } from '.././runtime/create-runtime-services.js';

function validateDomainSetting(key: string, value: string) {
  if (key === 'scheduler.concurrencyLimit') {
    const trimmed = value.trim();

    if (trimmed && (!/^\d+$/.test(trimmed) || Number(trimmed) < 1)) {
      throw new ValidationError([
        { field: 'value', reason: 'Concurrency limit must be a positive integer' },
      ]);
    }
  }

  if (
    key === SHORT_CHAPTER_REVIEW_ENABLED_KEY &&
    !['true', 'false'].includes(value)
  ) {
    throw new ValidationError([
      { field: 'value', reason: 'Short chapter review setting must be true or false' },
    ]);
  }
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
    async (request) => {
      const { value } = validate(SettingUpdateSchema, request.body);

      validateDomainSetting(request.params.key, value);

      services.settings.set(request.params.key, value);

      if (request.params.key === 'scheduler.concurrencyLimit') {
        const trimmed = value.trim();
        services.setSchedulerConcurrencyLimit(trimmed ? Number(trimmed) : null);
      }

      return { ok: true };
    }
  );
}
