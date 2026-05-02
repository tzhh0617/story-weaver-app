import { ipcMain } from 'electron';
import { getRuntimeServices } from '../runtime.js';
import {
  assertIpcPayload,
  ipcChannels,
} from '../../src/shared/contracts.js';

export function registerModelHandlers() {
  const { modelConfigs, getModelConfig, testModel } = getRuntimeServices();

  ipcMain.handle(ipcChannels.modelList, async () => {
    const modelConfig = getModelConfig();
    return modelConfig ? [modelConfig] : [];
  });
  ipcMain.handle(ipcChannels.modelSave, async (_event, payload) => {
    assertIpcPayload(ipcChannels.modelSave, payload);
    return modelConfigs.save(payload);
  });
  ipcMain.handle(
    ipcChannels.modelTest,
    async (_event, payload) => {
      assertIpcPayload(ipcChannels.modelTest, payload);
      return testModel(payload.modelId);
    }
  );
}
