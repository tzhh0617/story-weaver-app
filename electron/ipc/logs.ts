import { BrowserWindow } from 'electron';
import { getRuntimeServices } from '../runtime.js';
import { ipcChannels } from '../../src/shared/contracts.js';

export function registerLogHandlers() {
  const { subscribeExecutionLogs } = getRuntimeServices();

  subscribeExecutionLogs((log) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(ipcChannels.executionLog, log);
    }
  });
}
