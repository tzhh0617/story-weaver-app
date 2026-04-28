import { useEffect, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import ModelForm from '../components/ModelForm';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';

export default function Settings({
  onSaveModel,
  onTestModel,
  models,
  onDeleteModel,
  concurrencyLimit,
  onSaveSetting,
}: {
  onSaveModel: (input: {
    id: string;
    provider: string;
    modelName: string;
    apiKey: string;
    baseUrl: string;
    config: Record<string, unknown>;
  }) => void;
  onTestModel: (input: {
    id: string;
    provider: string;
    modelName: string;
    apiKey: string;
    baseUrl: string;
    config: Record<string, unknown>;
  }) => void;
  models: Array<{
    id: string;
    modelName: string;
    provider: string;
    apiKey?: string;
    baseUrl?: string;
    config?: Record<string, unknown>;
  }>;
  onDeleteModel: (modelId: string) => void;
  concurrencyLimit: number | null;
  onSaveSetting: (input: { concurrencyLimit: number | null }) => void;
}) {
  const syncedValue = concurrencyLimit?.toString() ?? '';
  const [concurrencyValue, setConcurrencyValue] = useState(syncedValue);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const selectedModel =
    models.find((model) => model.id === selectedModelId) ?? null;
  const trimmedConcurrencyValue = concurrencyValue.trim();
  const parsedConcurrencyValue = trimmedConcurrencyValue
    ? Number(trimmedConcurrencyValue)
    : null;
  const isConcurrencyValid =
    parsedConcurrencyValue === null ||
    (Number.isInteger(parsedConcurrencyValue) && parsedConcurrencyValue >= 1);
  const hasSettingChanges = trimmedConcurrencyValue !== syncedValue;
  const canSaveSettings = hasSettingChanges && isConcurrencyValid;

  useEffect(() => {
    setConcurrencyValue((currentValue) =>
      currentValue === syncedValue || currentValue === '' ? syncedValue : currentValue
    );
  }, [syncedValue]);

  useEffect(() => {
    if (!selectedModelId) {
      return;
    }

    if (!models.some((model) => model.id === selectedModelId)) {
      setSelectedModelId(null);
    }
  }, [models, selectedModelId]);

  return (
    <section className="grid gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">设置</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <ModelForm
          onSave={onSaveModel}
          onTest={onTestModel}
          selectedModel={selectedModel}
          onClearSelection={() => setSelectedModelId(null)}
        />
        <Card className="border-border/70 bg-card/95 shadow-panel">
          <CardHeader className="p-6 pb-0">
            <CardTitle>已保存模型</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-4">
            <ScrollArea aria-label="已保存模型列表">
              {models.length ? (
                <ul className="m-0 grid gap-3 p-0">
                  {models.map((model) => (
                    <li key={model.id} className="flex items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant={selectedModelId === model.id ? 'default' : 'secondary'}
                        aria-pressed={selectedModelId === model.id}
                        onClick={() => setSelectedModelId(model.id)}
                      >
                        {model.modelName} · {model.provider}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => onDeleteModel(model.id)}
                      >
                        删除模型
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="暂无模型"
                  description="还没有保存的模型配置。"
                />
              )}
            </ScrollArea>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95 shadow-panel">
          <CardHeader className="p-6 pb-0">
            <CardTitle>全局设置</CardTitle>
            <CardDescription>
              管理连续写作时允许同时运行的书籍数量。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-4">
            <label className="grid gap-2 font-medium">
              并发上限
              <Input
                aria-label="并发上限"
                type="number"
                min="1"
                placeholder="不限制"
                value={concurrencyValue}
                onChange={(event) => {
                  setConcurrencyValue(event.target.value);
                }}
              />
            </label>
            <Button
              type="button"
              disabled={!canSaveSettings}
              onClick={() =>
                onSaveSetting({
                  concurrencyLimit: parsedConcurrencyValue,
                })
              }
            >
              保存设置
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
