import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import type { createExportRegistry } from '../export-registry.js';

type ExportRegistry = ReturnType<typeof createExportRegistry>;

export async function registerExportRoutes(
  app: FastifyInstance,
  exportsRegistry: ExportRegistry
) {
  app.get<{ Params: { exportId: string } }>(
    '/api/exports/:exportId',
    async (request, reply) => {
      const download = exportsRegistry.get(request.params.exportId);

      if (!download) {
        return reply.status(404).send({ error: 'Export not found' });
      }

      return reply
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(download.fileName)}`
        )
        .send(createReadStream(download.filePath));
    }
  );
}
