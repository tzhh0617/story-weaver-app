import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  layoutCardClassName,
} from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const supportedProviders = ['openai', 'anthropic'] as const;
type SupportedProvider = (typeof supportedProviders)[number];

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'then' in value &&
    typeof value.then === 'function'
  );
}

function getSupportedProvider(provider?: string | null): SupportedProvider {
  return (
    supportedProviders.find(
      (supportedProvider) => supportedProvider === provider
    ) ?? 'openai'
  );
}

export default function ModelForm({
  onSave,
  onTest,
  selectedModel,
  onClearSelection,
  variant = 'card',
}: {
  onSave: (input: {
    id: string;
    provider: string;
    modelName: string;
    apiKey: string;
    baseUrl: string;
    config: Record<string, unknown>;
  }) => void | Promise<void>;
  onTest: (input: {
    id: string;
    provider: string;
    modelName: string;
    apiKey: string;
    baseUrl: string;
    config: Record<string, unknown>;
  }) => void | Promise<void>;
  selectedModel?: {
    provider: string;
    modelName: string;
    apiKey?: string;
    baseUrl?: string;
    config?: Record<string, unknown>;
  } | null;
  onClearSelection?: () => void;
  variant?: 'card' | 'inline';
}) {
  const [provider, setProvider] = useState(() =>
    getSupportedProvider(selectedModel?.provider)
  );
  const [modelName, setModelName] = useState(selectedModel?.modelName ?? '');
  const [apiKey, setApiKey] = useState(selectedModel?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(selectedModel?.baseUrl ?? '');
  const [config, setConfig] = useState<Record<string, unknown>>(
    selectedModel?.config ?? {}
  );
  const [isSavePending, setIsSavePending] = useState(false);

  useEffect(() => {
    if (!selectedModel) {
      setProvider('openai');
      setModelName('');
      setApiKey('');
      setBaseUrl('');
      setConfig({});
      return;
    }

    setProvider(getSupportedProvider(selectedModel.provider));
    setModelName(selectedModel.modelName);
    setApiKey(selectedModel.apiKey ?? '');
    setBaseUrl(selectedModel.baseUrl ?? '');
    setConfig(selectedModel.config ?? {});
  }, [selectedModel]);

  const effectiveProvider = getSupportedProvider(provider);
  const currentConfig = {
    id: `${effectiveProvider}:${modelName}`,
    provider: effectiveProvider,
    modelName,
    apiKey,
    baseUrl,
    config,
  };
  const canSubmitModel =
    modelName.trim().length > 0 &&
    apiKey.trim().length > 0;
  const isEditingModel = Boolean(selectedModel);
  const isInline = variant === 'inline';

  return (
    <form
      className={
        isInline
          ? 'grid gap-5'
          : `grid gap-5 p-6 ${layoutCardClassName}`
      }
      onSubmit={(event) => {
        event.preventDefault();
        if (isSavePending) {
          return;
        }

        const result = onSave(currentConfig);

        if (isPromiseLike(result)) {
          setIsSavePending(true);
          void Promise.resolve(result).then(
            () => setIsSavePending(false),
            () => setIsSavePending(false)
          );
        }
      }}
    >
      {!isInline ? (
        <CardHeader className="gap-3 p-0">
          <CardTitle>{isEditingModel ? '编辑模型' : '模型管理'}</CardTitle>
          <CardDescription>
            {isEditingModel
              ? '调整当前模型配置后重新保存。'
              : '配置 provider、model name、API Key 和 base URL。'}
          </CardDescription>
          {selectedModel && onClearSelection ? (
            <div>
              <Button type="button" variant="secondary" onClick={onClearSelection}>
                新建模型
              </Button>
            </div>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent className="grid gap-4 p-0">
        <div className="grid gap-2">
          <Label htmlFor="model-form-provider">Provider</Label>
          <select
            id="model-form-provider"
            className="sr-only"
            tabIndex={-1}
            value={provider}
            onChange={(event) =>
              setProvider(getSupportedProvider(event.target.value))
            }
          >
            {supportedProviders.map((providerOption) => (
              <option key={providerOption} value={providerOption}>
                {providerOption}
              </option>
            ))}
          </select>
          <Select
            value={provider}
            onValueChange={(nextProvider) =>
              setProvider(getSupportedProvider(nextProvider))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="选择 provider" />
            </SelectTrigger>
            <SelectContent>
              {supportedProviders.map((providerOption) => (
                <SelectItem key={providerOption} value={providerOption}>
                  {providerOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="model-form-base-url">Base URL</Label>
          <Input
            id="model-form-base-url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="model-form-api-key">API Key</Label>
          <Input
            id="model-form-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="model-form-name">Model Name</Label>
          <Input
            id="model-form-name"
            value={modelName}
            onChange={(event) => setModelName(event.target.value)}
          />
        </div>
        <div
          data-testid="model-form-actions"
          className="flex flex-wrap justify-end gap-3"
        >
          <Button
            type="button"
            variant="secondary"
            disabled={!canSubmitModel}
            onClick={() => onTest(currentConfig)}
          >
            测试连接
          </Button>
          <Button
            type="submit"
            disabled={!canSubmitModel || isSavePending}
            loading={isSavePending}
          >
            保存模型
          </Button>
        </div>
      </CardContent>
    </form>
  );
}
