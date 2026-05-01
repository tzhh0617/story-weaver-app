import type { FastifyInstance } from 'fastify';
import type {
  BookCreatePayload,
  BookExportFormat,
  BookExportResponse,
} from '../../src/shared/contracts.js';
import type { RuntimeServices } from '../../src/runtime/create-runtime-services.js';
import type { createExportRegistry } from '../export-registry.js';

type ExportRegistry = ReturnType<typeof createExportRegistry>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isBookCreatePayload(value: unknown): value is BookCreatePayload {
  return (
    isRecord(value) &&
    typeof value.idea === 'string' &&
    Number.isInteger(value.targetChapters) &&
    Number.isInteger(value.wordsPerChapter)
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
