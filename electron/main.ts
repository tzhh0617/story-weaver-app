import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { registerBookHandlers } from './ipc/books.js';
import { registerModelHandlers } from './ipc/models.js';
import { registerSchedulerHandlers } from './ipc/scheduler.js';
import { registerSettingsHandlers } from './ipc/settings.js';

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist-electron/electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    return;
  }

  await mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
}

app.whenReady().then(async () => {
  registerBookHandlers();
  registerModelHandlers();
  registerSchedulerHandlers();
  registerSettingsHandlers();

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
