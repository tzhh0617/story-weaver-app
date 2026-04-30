const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const schedulerProgressChannel = 'scheduler:progress';
const bookGenerationChannel = 'book:generation';
const executionLogChannel = 'logs:event';
const allowedInvokeChannels = new Set([
  'book:create',
  'book:delete',
  'book:list',
  'book:detail',
  'book:start',
  'book:pause',
  'book:writeNext',
  'book:writeAll',
  'book:resume',
  'book:restart',
  'book:export',
  'scheduler:startAll',
  'scheduler:pauseAll',
  'scheduler:status',
  'model:list',
  'model:save',
  'model:test',
  'settings:get',
  'settings:set',
]);

function assertAllowedInvokeChannel(channel: string) {
  if (!allowedInvokeChannels.has(channel)) {
    throw new Error(`Unsupported IPC channel: ${channel}`);
  }
}

contextBridge.exposeInMainWorld('storyWeaver', {
  invoke: <T,>(channel: string, payload?: unknown) => {
    assertAllowedInvokeChannel(channel);
    return ipcRenderer.invoke(channel, payload) as Promise<T>;
  },
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
  onExecutionLog: (listener: (payload: unknown) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) =>
      listener(payload);
    ipcRenderer.on(executionLogChannel, wrapped);

    return () => {
      ipcRenderer.removeListener(executionLogChannel, wrapped);
    };
  },
});
