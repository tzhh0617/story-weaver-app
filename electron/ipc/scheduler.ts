import { BrowserWindow, ipcMain } from 'electron';
import { getRuntimeServices } from '../runtime.js';
import { ipcChannels } from '../../src/shared/contracts.js';

export function registerSchedulerHandlers() {
  const {
    startAllBooks,
    pauseAllBooks,
    getSchedulerStatus,
    subscribeSchedulerStatus,
  } = getRuntimeServices();

  subscribeSchedulerStatus((status) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(ipcChannels.schedulerProgress, status);
    }
  });

  ipcMain.handle(ipcChannels.schedulerStartAll, async () => startAllBooks());
  ipcMain.handle(ipcChannels.schedulerPauseAll, async () => pauseAllBooks());
  ipcMain.handle(ipcChannels.schedulerStatus, async () => getSchedulerStatus());
}
