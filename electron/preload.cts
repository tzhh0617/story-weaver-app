const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const schedulerProgressChannel = 'scheduler:progress';
const bookGenerationChannel = 'book:generation';

contextBridge.exposeInMainWorld('storyWeaver', {
  invoke: <T,>(channel: string, payload?: unknown) =>
    ipcRenderer.invoke(channel, payload) as Promise<T>,
  onProgress: (listener: (payload: unknown) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) =>
      listener(payload);
    ipcRenderer.on(schedulerProgressChannel, wrapped);

    return () => {
      ipcRenderer.removeListener(schedulerProgressChannel, wrapped);
    };
  },
  onBookGeneration: (listener: (payload: unknown) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) =>
      listener(payload);
    ipcRenderer.on(bookGenerationChannel, wrapped);

    return () => {
      ipcRenderer.removeListener(bookGenerationChannel, wrapped);
    };
  },
});
