import { ipcMain } from 'electron';
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
      settings.set(payload.key, payload.value);

      if (payload.key === 'scheduler.concurrencyLimit') {
        const trimmed = payload.value.trim();

        if (trimmed && (!/^\d+$/.test(trimmed) || Number(trimmed) < 1)) {
          throw new Error('Concurrency limit must be a positive integer');
        }

        setSchedulerConcurrencyLimit(trimmed ? Number(trimmed) : null);
      }

      return true;
    }
  );
}
