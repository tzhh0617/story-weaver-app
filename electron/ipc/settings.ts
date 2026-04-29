import { ipcMain } from 'electron';
import { SHORT_CHAPTER_REVIEW_ENABLED_KEY } from '../../src/core/chapter-review.js';
import { ipcChannels } from '../../src/shared/contracts.js';
import { getRuntimeServices } from '../runtime.js';

export function registerSettingsHandlers() {
  const { settings, setSchedulerConcurrencyLimit } = getRuntimeServices();

  ipcMain.handle(ipcChannels.settingsGet, async (_event, key?: string) => {
    if (!key) {
      return settings.list();
    }

    return settings.get(key);
  });

  ipcMain.handle(
    ipcChannels.settingsSet,
    async (_event, payload: { key: string; value: string }) => {
      if (payload.key === 'scheduler.concurrencyLimit') {
        const trimmed = payload.value.trim();

        if (trimmed && (!/^\d+$/.test(trimmed) || Number(trimmed) < 1)) {
          throw new Error('Concurrency limit must be a positive integer');
        }
      }

      if (
        payload.key === SHORT_CHAPTER_REVIEW_ENABLED_KEY &&
        !['true', 'false'].includes(payload.value)
      ) {
        throw new Error('Short chapter review setting must be true or false');
      }

      settings.set(payload.key, payload.value);

      if (payload.key === 'scheduler.concurrencyLimit') {
        const trimmed = payload.value.trim();
        setSchedulerConcurrencyLimit(trimmed ? Number(trimmed) : null);
      }

      return true;
    }
  );
}
