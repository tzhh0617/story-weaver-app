import { SHORT_CHAPTER_REVIEW_ENABLED_KEY } from '../src/core/chapter-review.js';
import {
  assertIpcPayload,
  type BookCreatePayload,
  type BookExportPayload,
  type BookIdPayload,
  ipcChannels,
  type IpcInvokeChannel,
  type ModelSavePayload,
  type ModelTestPayload,
  type SettingsSetPayload,
} from '../src/shared/contracts.js';
import type { RuntimeServices } from '../src/runtime/create-runtime-services.js';
import type { createExportRegistry } from './export-registry.js';

type ExportRegistry = ReturnType<typeof createExportRegistry>;

export async function dispatchInvoke(
  services: RuntimeServices,
  channel: IpcInvokeChannel,
  payload: unknown,
  options?: { exportsRegistry?: ExportRegistry }
): Promise<unknown> {
  assertIpcPayload(channel, payload);

  switch (channel) {
    case ipcChannels.bookCreate:
      return services.bookService.createBook(payload as BookCreatePayload);
    case ipcChannels.bookDelete:
      await services.deleteBook((payload as BookIdPayload).bookId);
      return undefined;
    case ipcChannels.bookList:
      return services.bookService.listBooks();
    case ipcChannels.bookDetail:
      return services.bookService.getBookDetail((payload as BookIdPayload).bookId);
    case ipcChannels.bookStart:
      await services.startBook((payload as BookIdPayload).bookId);
      return undefined;
    case ipcChannels.bookPause:
      services.pauseBook((payload as BookIdPayload).bookId);
      return undefined;
    case ipcChannels.bookWriteNext:
      return services.writeNextChapter((payload as BookIdPayload).bookId);
    case ipcChannels.bookWriteAll:
      return services.writeRemainingChapters((payload as BookIdPayload).bookId);
    case ipcChannels.bookResume:
      await services.resumeBook((payload as BookIdPayload).bookId);
      return undefined;
    case ipcChannels.bookRestart:
      await services.restartBook((payload as BookIdPayload).bookId);
      return undefined;
    case ipcChannels.bookExport:
      const filePath = await services.exportBook(
        (payload as BookExportPayload).bookId,
        (payload as BookExportPayload).format
      );
      if (!options?.exportsRegistry) {
        return filePath;
      }
      return options.exportsRegistry.register(filePath);
    case ipcChannels.schedulerStartAll:
      await services.startAllBooks();
      return undefined;
    case ipcChannels.schedulerPauseAll:
      await services.pauseAllBooks();
      return undefined;
    case ipcChannels.schedulerStatus:
      return services.getSchedulerStatus();
    case ipcChannels.modelList:
      return services.modelConfigs.list();
    case ipcChannels.modelSave:
      services.modelConfigs.save(payload as ModelSavePayload);
      return undefined;
    case ipcChannels.modelTest:
      return services.testModel((payload as ModelTestPayload).modelId);
    case ipcChannels.settingsGet:
      return payload ? services.settings.get(payload as string) : services.settings.list();
    case ipcChannels.settingsSet: {
      const settingsPayload = payload as SettingsSetPayload;
      if (settingsPayload.key === 'scheduler.concurrencyLimit') {
        const trimmed = settingsPayload.value.trim();

        if (trimmed && (!/^\d+$/.test(trimmed) || Number(trimmed) < 1)) {
          throw new Error('Concurrency limit must be a positive integer');
        }
      }

      if (
        settingsPayload.key === SHORT_CHAPTER_REVIEW_ENABLED_KEY &&
        !['true', 'false'].includes(settingsPayload.value)
      ) {
        throw new Error('Short chapter review setting must be true or false');
      }

      services.settings.set(settingsPayload.key, settingsPayload.value);

      if (settingsPayload.key === 'scheduler.concurrencyLimit') {
        const trimmed = settingsPayload.value.trim();
        services.setSchedulerConcurrencyLimit(trimmed ? Number(trimmed) : null);
      }

      return true;
    }
    default:
      throw new Error(`Unsupported invoke channel: ${channel}`);
  }
}
