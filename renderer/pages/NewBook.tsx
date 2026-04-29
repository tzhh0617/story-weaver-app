import { useState } from 'react';
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
import { Textarea } from '../components/ui/textarea';

const targetChapterOptions = [500, 800, 1000, 1500, 2000] as const;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'then' in value &&
    typeof value.then === 'function'
  );
}

export default function NewBook({
  onCreate,
}: {
  onCreate: (input: {
    idea: string;
    targetChapters: number;
    wordsPerChapter: number;
  }) => void | Promise<void>;
}) {
  const [idea, setIdea] = useState('');
  const [targetChapters, setTargetChapters] = useState(500);
  const [wordsPerChapter, setWordsPerChapter] = useState(2500);
  const [isCreatePending, setIsCreatePending] = useState(false);
  const hasValidTargetChapters =
    Number.isInteger(targetChapters) &&
    targetChapterOptions.includes(
      targetChapters as (typeof targetChapterOptions)[number]
    );
  const hasValidWordsPerChapter =
    Number.isInteger(wordsPerChapter) && wordsPerChapter > 0;
  const canSubmit =
    idea.trim().length > 0 &&
    hasValidTargetChapters &&
    hasValidWordsPerChapter;

  return (
    <section className="grid w-full gap-6">
      <div
        data-testid="new-book-intro-panel"
        className={pageIntroPanelClassName}
      >
        <p className={pageIntroEyebrowClassName}>New Manuscript</p>
        <h2 className={pageIntroTitleClassName}>新建作品</h2>
        <p className={pageIntroDescriptionClassName}>
          先写下故事钩子、核心冲突或主角目标。这里更像给一本新书贴第一张索引卡，而不是填写一串系统参数。
        </p>
      </div>
      <Card data-testid="new-book-form-panel" className={layoutCardClassName}>
        <form
          className="grid gap-0 lg:grid-cols-[16rem_minmax(0,1fr)]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              return;
            }

            if (isCreatePending) {
              return;
            }

            const result = onCreate({ idea, targetChapters, wordsPerChapter });

            if (isPromiseLike(result)) {
              setIsCreatePending(true);
              void Promise.resolve(result).then(
                () => setIsCreatePending(false),
                () => setIsCreatePending(false)
              );
            }
          }}
        >
          <CardHeader
            className={`${layoutCardHeaderClassName} lg:border-b-0 lg:border-r`}
          >
            <CardTitle>创作索引</CardTitle>
            <CardDescription className="leading-6">
              故事起点越清晰，后续世界观、大纲和章节推进越稳定。
            </CardDescription>
          </CardHeader>
          <CardContent
            data-testid="new-book-fields-panel"
            className="grid gap-5 p-6"
          >
            <div className="grid gap-2">
              <Label htmlFor="new-book-idea">故事设想</Label>
              <Textarea
                id="new-book-idea"
                className="min-h-40"
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-book-target-chapters">目标章节数</Label>
              <select
                id="new-book-target-chapters"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                value={targetChapters}
                onChange={(event) =>
                  setTargetChapters(Number(event.target.value))
                }
              >
                {targetChapterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} 章
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-book-words-per-chapter">每章字数</Label>
              <Input
                id="new-book-words-per-chapter"
                type="number"
                min={1}
                value={wordsPerChapter}
                onChange={(event) =>
                  setWordsPerChapter(Number(event.target.value))
                }
              />
            </div>
            <Button
              type="submit"
              disabled={!canSubmit || isCreatePending}
              loading={isCreatePending}
              className="w-fit"
            >
              开始写作
            </Button>
          </CardContent>
        </form>
      </Card>
    </section>
  );
}
