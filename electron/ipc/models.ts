import { ipcMain } from 'electron';
import { getRuntimeServices } from '../runtime.js';
import { ipcChannels } from '../../src/shared/contracts.js';

export function registerModelHandlers() {
  const { modelConfigs, testModel } = getRuntimeServices();

  ipcMain.handle(ipcChannels.modelList, async () => modelConfigs.list());
  ipcMain.handle(ipcChannels.modelSave, async (_event, payload) =>
    modelConfigs.save(payload)
  );
  ipcMain.handle(
    ipcChannels.modelTest,
    async (_event, payload: { modelId: string }) => testModel(payload.modelId)
  );
  ipcMain.handle(ipcChannels.modelDelete, async (_event, payload: { id: string }) =>
    modelConfigs.delete(payload.id)
  );
}
