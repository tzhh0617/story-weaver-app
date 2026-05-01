import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type ExportDownload = {
  id: string;
  filePath: string;
  fileName: string;
  downloadUrl: string;
};

export function createExportRegistry() {
  const exportsById = new Map<string, ExportDownload>();

  return {
    register(filePath: string) {
      const id = randomUUID();
      const download: ExportDownload = {
        id,
        filePath,
        fileName: path.basename(filePath),
        downloadUrl: `/api/exports/${id}`,
      };

      exportsById.set(id, download);

      return download;
    },
    get(id: string) {
      return exportsById.get(id) ?? null;
    },
  };
}
