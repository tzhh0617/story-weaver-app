import type { FastifyInstance } from 'fastify';
import type { BookExportResponse } from '@story-weaver/shared/contracts';
import { validate } from '@story-weaver/shared/validation';
import { BookCreateSchema, BookExportRequestSchema } from '@story-weaver/shared/schemas/book-schemas';
import type { RuntimeServices } from '.././runtime/create-runtime-services.js';
import type { createExportRegistry } from '../export-registry.js';

type ExportRegistry = ReturnType<typeof createExportRegistry>;

export async function registerBookRoutes(
  app: FastifyInstance,
  services: RuntimeServices,
  options: { exportsRegistry: ExportRegistry }
) {
  app.get('/api/books', async () => services.bookService.listBooks());

  app.post('/api/books', async (request) => {
    const payload = validate(BookCreateSchema, request.body);
    const bookId = await services.bookService.createBook(payload);
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

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/exports',
    async (request, reply): Promise<BookExportResponse | unknown> => {
      const { format } = validate(BookExportRequestSchema, request.body);
      const filePath = await services.exportBook(
        request.params.bookId,
        format
      );
      return options.exportsRegistry.register(filePath);
    }
  );
}
