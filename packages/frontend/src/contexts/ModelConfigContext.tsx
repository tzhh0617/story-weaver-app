import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';

type ModelConfigView = {
  id: string;
  provider: string;
  modelName: string;
  apiKey: string;
  baseUrl: string;
  config: Record<string, unknown>;
};

type ToastFn = (tone: 'error' | 'success' | 'info', message: string) => void;

type ModelConfigContextValue = {
  modelConfigs: ModelConfigView[];
  shortChapterReviewEnabled: boolean;
  loadModels: () => Promise<void>;
  loadSettings: () => Promise<void>;
  setShortChapterReviewEnabled: (v: boolean) => void;
};

const ModelConfigContext = createContext<ModelConfigContextValue | null>(null);

export function ModelConfigProvider({ children, toast }: { children: ReactNode; toast: ToastFn }) {
  const api = useStoryWeaverApi();
  const [modelConfigs, setModelConfigs] = useState<ModelConfigView[]>([]);
  const [shortChapterReviewEnabled, setShortChapterReviewEnabled] = useState(true);

  const loadModels = useCallback(async () => {
    const configs = await api.listModels();
    setModelConfigs(Array.isArray(configs) ? configs : []);
  }, [api]);

  const loadSettings = useCallback(async () => {
    const { parseBooleanSetting, SHORT_CHAPTER_REVIEW_ENABLED_KEY } = await import('@story-weaver/shared/settings');
    const value = await api.getSetting(SHORT_CHAPTER_REVIEW_ENABLED_KEY);
    setShortChapterReviewEnabled(parseBooleanSetting(typeof value === 'string' ? value : null));
  }, [api]);

  return (
    <ModelConfigContext.Provider value={{
      modelConfigs,
      shortChapterReviewEnabled,
      loadModels,
      loadSettings,
      setShortChapterReviewEnabled,
    }}>
      {children}
    </ModelConfigContext.Provider>
  );
}

export function useModelConfigs() {
  const ctx = useContext(ModelConfigContext);
  if (!ctx) throw new Error('useModelConfigs must be used within ModelConfigProvider');
  return ctx;
}
