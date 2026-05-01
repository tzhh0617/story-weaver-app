import { app, BrowserWindow, nativeImage } from 'electron';
import path from 'node:path';
import { startServer } from '../server/main.js';

let server: Awaited<ReturnType<typeof startServer>> | null = null;

function appendApiBase(url: string, apiBase: string) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set('storyWeaverApi', apiBase);
  return nextUrl.toString();
}

async function ensureServer() {
  if (!server) {
    server = await startServer({
      staticDir: path.join(app.getAppPath(), 'dist'),
    });
  }

  return server;
}

async function createWindow() {
  const runningServer = await ensureServer();
  const appIcon = nativeImage.createFromPath(
    path.join(app.getAppPath(), 'build/icon.png')
  );

  if (process.platform === 'darwin' && app.dock && !appIcon.isEmpty()) {
    app.dock.setIcon(appIcon);
  }

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    title: 'Story Weaver',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 13 },
    backgroundColor: '#efe6d5',
    icon: appIcon.isEmpty() ? undefined : appIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(
      appendApiBase(process.env.VITE_DEV_SERVER_URL, runningServer.url)
    );
    return;
  }

  await mainWindow.loadURL(runningServer.url);
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('before-quit', async () => {
  if (server) {
    await server.app.close();
    server = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
