import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ConflictError } from '@story-weaver/shared/errors';

const MAX_EXPORTS = 50;
const TTL_MS = 30 * 60 * 1000;

export type ExportDownload = {
  id: string;
  filePath: string;
  fileName: string;
  downloadUrl: string;
  createdAt: number;
};

export function createExportRegistry() {
  const exportsById = new Map<string, ExportDownload>();

  function sweepExpired() {
    const now = Date.now();
    for (const [id, entry] of exportsById) {
      if (now - entry.createdAt > TTL_MS) {
        exportsById.delete(id);
      }
    }
  }

  return {
    register(filePath: string) {
      sweepExpired();

      if (exportsById.size >= MAX_EXPORTS) {
        throw new ConflictError('Export registry is full. Try again later.');
      }

      const id = randomUUID();
      const download: ExportDownload = {
        id,
        filePath,
        fileName: path.basename(filePath),
        downloadUrl: `/api/exports/${id}`,
        createdAt: Date.now(),
      };

      exportsById.set(id, download);
      return download;
    },
    get(id: string) {
      sweepExpired();
      return exportsById.get(id) ?? null;
    },
    /** @internal test-only accessor */
    _exportsById: exportsById,
  };
}
