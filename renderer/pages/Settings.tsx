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
import { Label } from '../components/ui/label';
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
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">设置</h2>
        <p className="text-sm text-muted-foreground">
          管理模型连接与写作调度参数。
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="rounded-2xl shadow-none">
          <CardHeader>
            <CardTitle>已保存模型</CardTitle>
            <CardDescription>选择一个模型进行编辑或删除。</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea aria-label="已保存模型列表" className="max-h-[28rem] pr-2">
              {models.length ? (
                <ul className="m-0 grid gap-3 p-0">
                  {models.map((model) => (
                    <li key={model.id} className="grid gap-2">
                      <Button
                        type="button"
                        variant={selectedModelId === model.id ? 'default' : 'secondary'}
                        aria-pressed={selectedModelId === model.id}
                        className="justify-start"
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
        <div className="grid gap-6">
          <ModelForm
            onSave={onSaveModel}
            onTest={onTestModel}
            selectedModel={selectedModel}
            onClearSelection={() => setSelectedModelId(null)}
          />
          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <CardTitle>全局设置</CardTitle>
              <CardDescription>
                管理连续写作时允许同时运行的书籍数量。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="settings-concurrency-limit">并发上限</Label>
                <Input
                  id="settings-concurrency-limit"
                  type="number"
                  min="1"
                  placeholder="不限制"
                  value={concurrencyValue}
                  onChange={(event) => {
                    setConcurrencyValue(event.target.value);
                  }}
                />
              </div>
              <Button
                type="button"
                disabled={!canSaveSettings}
                className="w-fit"
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
      </div>
    </section>
  );
}
