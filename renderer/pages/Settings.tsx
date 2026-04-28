import { useEffect, useState } from 'react';
import ModelForm from '../components/ModelForm';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  layoutCardClassName,
  layoutCardHeaderClassName,
  pageIntroDescriptionClassName,
  pageIntroEyebrowClassName,
  pageIntroPanelClassName,
  pageIntroTitleClassName,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const settingCardClass = `mb-5 break-inside-avoid ${layoutCardClassName}`;

export default function Settings({
  onSaveModel,
  onTestModel,
  models,
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
  concurrencyLimit: number | null;
  onSaveSetting: (input: { concurrencyLimit: number | null }) => void;
}) {
  const syncedValue = concurrencyLimit?.toString() ?? '';
  const [concurrencyValue, setConcurrencyValue] = useState(syncedValue);
  const selectedModel = models[0] ?? null;
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

  return (
    <section className="grid gap-6">
      <header data-testid="settings-intro-panel" className={pageIntroPanelClassName}>
        <p className={pageIntroEyebrowClassName}>Studio Settings</p>
        <h1 className={pageIntroTitleClassName}>设置</h1>
        <p className={pageIntroDescriptionClassName}>
          管理模型连接与写作调度参数。
        </p>
      </header>

      <div
        role="list"
        aria-label="设置项"
        className="columns-1 gap-5 xl:columns-2 2xl:columns-3"
      >
        <Card role="listitem" className={settingCardClass}>
          <CardHeader className={layoutCardHeaderClassName}>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Model
            </p>
            <CardTitle className="text-xl">模型设置</CardTitle>
            <CardDescription>
              保存一个当前写作使用的模型连接。
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ModelForm
              onSave={onSaveModel}
              onTest={onTestModel}
              selectedModel={selectedModel}
              variant="inline"
            />
          </CardContent>
        </Card>

        <Card role="listitem" className={settingCardClass}>
          <CardHeader className={layoutCardHeaderClassName}>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Writing
            </p>
            <CardTitle className="text-xl">写作设置</CardTitle>
            <CardDescription>
              管理连续写作时允许同时运行的书籍数量。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6">
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
    </section>
  );
}
