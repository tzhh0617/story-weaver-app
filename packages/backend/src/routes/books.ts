import type { FastifyInstance } from 'fastify';
import type {
  BookCreatePayload,
  BookExportFormat,
  BookExportResponse,
  ViralTropeContractPayload,
} from '@story-weaver/shared/contracts';
import type { RuntimeServices } from '.././runtime/create-runtime-services.js';
import type { createExportRegistry } from '../export-registry.js';

type ExportRegistry = ReturnType<typeof createExportRegistry>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isViralTropeContract(value: unknown): value is ViralTropeContractPayload {
  return (
    value === 'rebirth_change_fate' ||
    value === 'system_growth' ||
    value === 'hidden_identity' ||
    value === 'revenge_payback' ||
    value === 'weak_to_strong' ||
    value === 'forbidden_bond' ||
    value === 'case_breaking' ||
    value === 'sect_or_family_pressure' ||
    value === 'survival_game' ||
    value === 'business_or_power_game'
  );
}

function isViralStrategyPayload(value: unknown) {
  if (value === undefined) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  const cadence = value.cadenceMode;
  return (
    (value.readerPayoff === undefined || typeof value.readerPayoff === 'string') &&
    (value.protagonistDesire === undefined ||
      typeof value.protagonistDesire === 'string') &&
    (value.tropeContracts === undefined ||
      (Array.isArray(value.tropeContracts) &&
        value.tropeContracts.every(isViralTropeContract))) &&
    (cadence === undefined ||
      cadence === 'fast' ||
      cadence === 'steady' ||
      cadence === 'slow_burn' ||
      cadence === 'suppressed_then_burst') &&
    (value.antiClicheDirection === undefined ||
      typeof value.antiClicheDirection === 'string')
  );
}

function isBookCreatePayload(value: unknown): value is BookCreatePayload {
  return (
    isRecord(value) &&
    typeof value.idea === 'string' &&
    Number.isInteger(value.targetChapters) &&
    Number(value.targetChapters) > 0 &&
    Number.isInteger(value.wordsPerChapter) &&
    Number(value.wordsPerChapter) > 0 &&
    isViralStrategyPayload(value.viralStrategy)
  );
}

function isExportFormat(value: unknown): value is BookExportFormat {
  return value === 'txt' || value === 'md';
}

export async function registerBookRoutes(
  app: FastifyInstance,
  services: RuntimeServices,
  options: { exportsRegistry: ExportRegistry }
) {
  app.get('/api/books', async () => services.bookService.listBooks());

  app.post('/api/books', async (request, reply) => {
    if (!isBookCreatePayload(request.body)) {
      return reply.status(400).send({ error: 'Invalid book create payload' });
    }

    const bookId = await services.bookService.createBook(request.body);
    return { bookId };
  });

  app.get<{ Params: { bookId: string } }>(
    '/api/books/:bookId',
    async (request) => services.bookService.getBookDetail(request.params.bookId)
  );

  app.delete<{ Params: { bookId: string } }>(
    '/api/books/:bookId',
    async (request) => {
      await services.deleteBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/start',
    async (request) => {
      await services.startBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/pause',
    async (request) => {
      services.pauseBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/resume',
    async (request) => {
      await services.resumeBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/restart',
    async (request) => {
      await services.restartBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/chapters/write-next',
    async (request) => services.writeNextChapter(request.params.bookId)
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/chapters/write-all',
    async (request) => services.writeRemainingChapters(request.params.bookId)
  );

  app.post<{ Params: { bookId: string }; Body: { format?: unknown } }>(
    '/api/books/:bookId/exports',
    async (request, reply): Promise<BookExportResponse | unknown> => {
      if (!isExportFormat(request.body?.format)) {
        return reply.status(400).send({ error: 'Invalid export format' });
      }

      const filePath = await services.exportBook(
        request.params.bookId,
        request.body.format
      );
      return options.exportsRegistry.register(filePath);
    }
  );
}
