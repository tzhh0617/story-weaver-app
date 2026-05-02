import { useCallback } from 'react';
import {
  serializeBooleanSetting,
  SHORT_CHAPTER_REVIEW_ENABLED_KEY,
} from '@story-weaver/shared/settings';
import type { ModelSavePayload } from '@story-weaver/shared/contracts';
import { useModelConfigs } from '../contexts/ModelConfigContext';
import { useSchedulerContext } from '../contexts/SchedulerContext';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';
import { useApiCall } from '../hooks/useApiCall';
import type { ToastFn } from './route-utils';
import Settings from './Settings';

export default function SettingsRoute({ showToast }: { showToast: ToastFn }) {
  const api = useStoryWeaverApi();
  const { modelConfigs, shortChapterReviewEnabled, loadModels, setShortChapterReviewEnabled } =
    useModelConfigs();
  const { progress } = useSchedulerContext();
  const call = useApiCall(showToast);

  const handleSaveModel = useCallback(async (input: ModelSavePayload) => {
    showToast('info', '正在保存模型...');
    const result = await call(async () => { await api.saveModel(input); return true as const; });
    if (result === undefined) {
      throw new Error('Failed to save model');
    }
    await loadModels();
    showToast('success', '模型已保存');
  }, [showToast, call, api, loadModels]);

  const handleTestModel = useCallback(async (input: ModelSavePayload) => {
    showToast('info', '正在测试模型连接...');
    const saveResult = await call(async () => { await api.saveModel(input); return true as const; });
    if (saveResult !== undefined) {
      const testResult = await call(() => api.testModel(input.id));

      if (!testResult?.ok) {
        showToast('error', testResult?.error ?? 'Model test failed');
      } else {
        showToast('success', `连接成功（${testResult.latency}ms）`);
      }
    }
    await loadModels();
  }, [showToast, call, api, loadModels]);

  const handleSaveSetting = useCallback(async (input: {
    concurrencyLimit: number | null;
    shortChapterReviewEnabled: boolean;
  }) => {
    showToast('info', '正在保存设置...');
    const result = await call(async () => {
      await Promise.all([
        api.setSetting(
          'scheduler.concurrencyLimit',
          input.concurrencyLimit === null
            ? ''
            : String(input.concurrencyLimit)
        ),
        api.setSetting(
          SHORT_CHAPTER_REVIEW_ENABLED_KEY,
          serializeBooleanSetting(input.shortChapterReviewEnabled)
        ),
      ]);
      return true as const;
    });
    if (result !== undefined) {
      setShortChapterReviewEnabled(
        input.shortChapterReviewEnabled
      );
      showToast('success', '设置已保存');
    }
  }, [showToast, call, api, setShortChapterReviewEnabled]);

  return (
    <Settings
      onSaveModel={handleSaveModel}
      onTestModel={handleTestModel}
      models={modelConfigs.map((config) => ({
        id: config.id,
        modelName: config.modelName,
        provider: config.provider,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        config: config.config,
      }))}
      concurrencyLimit={progress.concurrencyLimit}
      shortChapterReviewEnabled={shortChapterReviewEnabled}
      onSaveSetting={handleSaveSetting}
    />
  );
}
