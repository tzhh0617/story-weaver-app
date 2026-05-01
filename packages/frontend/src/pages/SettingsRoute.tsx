import { useCallback } from 'react';
import {
  serializeBooleanSetting,
  SHORT_CHAPTER_REVIEW_ENABLED_KEY,
} from '@story-weaver/shared/settings';
import type { ModelSavePayload } from '@story-weaver/shared/contracts';
import { useModelConfigs } from '../contexts/ModelConfigContext';
import { useSchedulerContext } from '../contexts/SchedulerContext';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';
import type { ToastFn } from './route-utils';
import Settings from './Settings';

export default function SettingsRoute({ showToast }: { showToast: ToastFn }) {
  const api = useStoryWeaverApi();
  const { modelConfigs, shortChapterReviewEnabled, loadModels, setShortChapterReviewEnabled } =
    useModelConfigs();
  const { progress } = useSchedulerContext();

  const handleSaveModel = useCallback(async (input: ModelSavePayload) => {
    try {
      showToast('info', '正在保存模型...');
      await api.saveModel(input);
      await loadModels();
      showToast('success', '模型已保存');
    } catch (error) {
      showToast(
        'error',
        error instanceof Error ? error.message : 'Failed to save model'
      );
      throw error;
    }
  }, [showToast, api, loadModels]);

  const handleTestModel = useCallback(async (input: ModelSavePayload) => {
    try {
      showToast('info', '正在测试模型连接...');
      await api.saveModel(input);
      const result = await api.testModel(input.id);

      if (!result.ok) {
        showToast('error', result.error ?? 'Model test failed');
      } else {
        showToast('success', `连接成功（${result.latency}ms）`);
      }
    } catch (error) {
      showToast(
        'error',
        error instanceof Error ? error.message : 'Model test failed'
      );
    }
    await loadModels();
  }, [showToast, api, loadModels]);

  const handleSaveSetting = useCallback(async (input: {
    concurrencyLimit: number | null;
    shortChapterReviewEnabled: boolean;
  }) => {
    try {
      showToast('info', '正在保存设置...');
      await api.setSetting(
        'scheduler.concurrencyLimit',
        input.concurrencyLimit === null
          ? ''
          : String(input.concurrencyLimit)
      );
      await api.setSetting(
        SHORT_CHAPTER_REVIEW_ENABLED_KEY,
        serializeBooleanSetting(input.shortChapterReviewEnabled)
      );
      setShortChapterReviewEnabled(
        input.shortChapterReviewEnabled
      );
      showToast('success', '设置已保存');
    } catch (error) {
      showToast(
        'error',
        error instanceof Error ? error.message : 'Failed to save settings'
      );
    }
  }, [showToast, api, setShortChapterReviewEnabled]);

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
