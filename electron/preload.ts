import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { ipcChannels } from '../src/shared/contracts.js';

contextBridge.exposeInMainWorld('storyWeaver', {
  invoke: <T>(channel: string, payload?: unknown) =>
    ipcRenderer.invoke(channel, payload) as Promise<T>,
  onProgress: (listener: (payload: unknown) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: unknown) => listener(payload);
    ipcRenderer.on(ipcChannels.schedulerProgress, wrapped);

    return () => {
      ipcRenderer.removeListener(ipcChannels.schedulerProgress, wrapped);
    };
  },
});
