import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Input } from './ui/input';
import { Select } from './ui/select';

const openAICompatibleProviders = new Set([
  'deepseek',
  'qwen',
  'glm',
  'custom',
]);

export default function ModelForm({
  onSave,
  onTest,
  selectedModel,
  onClearSelection,
}: {
  onSave: (input: {
    id: string;
    provider: string;
    modelName: string;
    apiKey: string;
    baseUrl: string;
    config: Record<string, unknown>;
  }) => void;
  onTest: (input: {
    id: string;
    provider: string;
    modelName: string;
    apiKey: string;
    baseUrl: string;
    config: Record<string, unknown>;
  }) => void;
  selectedModel?: {
    provider: string;
    modelName: string;
    apiKey?: string;
    baseUrl?: string;
    config?: Record<string, unknown>;
  } | null;
  onClearSelection?: () => void;
}) {
  const [provider, setProvider] = useState('openai');
  const [modelName, setModelName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [config, setConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!selectedModel) {
      setProvider('openai');
      setModelName('');
      setApiKey('');
      setBaseUrl('');
      setConfig({});
      return;
    }

    setProvider(selectedModel.provider);
    setModelName(selectedModel.modelName);
    setApiKey(selectedModel.apiKey ?? '');
    setBaseUrl(selectedModel.baseUrl ?? '');
    setConfig(selectedModel.config ?? {});
  }, [selectedModel]);

  const currentConfig = {
    id: `${provider}:${modelName}`,
    provider,
    modelName,
    apiKey,
    baseUrl,
    config,
  };
  const canSubmitModel =
    modelName.trim().length > 0 &&
    apiKey.trim().length > 0 &&
    (!openAICompatibleProviders.has(provider) || baseUrl.trim().length > 0);
  const isEditingModel = Boolean(selectedModel);

  return (
    <form
      className="grid gap-4 rounded-3xl border border-border/70 bg-card/95 p-6 shadow-panel"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(currentConfig);
      }}
    >
      <CardHeader className="gap-3 p-0">
        <CardTitle>{isEditingModel ? '编辑模型' : '模型管理'}</CardTitle>
        <CardDescription>
          {isEditingModel
            ? '调整当前模型配置后重新保存。'
            : '配置 provider、model name、API Key 和 base URL。'}
        </CardDescription>
        {selectedModel ? (
          <div>
            <Button type="button" variant="secondary" onClick={onClearSelection}>
              新建模型
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 p-0">
        <label className="grid gap-2 font-medium">
          Provider
          <Select
            aria-label="Provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            <option value="openai">openai</option>
            <option value="anthropic">anthropic</option>
            <option value="deepseek">deepseek</option>
            <option value="qwen">qwen</option>
            <option value="glm">glm</option>
            <option value="custom">custom</option>
          </Select>
        </label>
        <label className="grid gap-2 font-medium">
          Model Name
          <Input
            aria-label="Model Name"
            value={modelName}
            onChange={(event) => setModelName(event.target.value)}
          />
        </label>
        <label className="grid gap-2 font-medium">
          API Key
          <Input
            aria-label="API Key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>
        <label className="grid gap-2 font-medium">
          Base URL
          <Input
            aria-label="Base URL"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!canSubmitModel}>
            保存模型
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!canSubmitModel}
            onClick={() => {
              onTest(currentConfig);
            }}
          >
            测试连接
          </Button>
        </div>
      </CardContent>
    </form>
  );
}
