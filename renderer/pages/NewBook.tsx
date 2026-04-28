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

export default function NewBook({
  onCreate,
}: {
  onCreate: (input: {
    idea: string;
    targetWords: number;
  }) => void;
}) {
  const [idea, setIdea] = useState('');
  const [targetWords, setTargetWords] = useState(500000);
  const hasValidTargetWords =
    Number.isInteger(targetWords) && targetWords > 0;
  const canSubmit = idea.trim().length > 0 && hasValidTargetWords;

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

            onCreate({ idea, targetWords });
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
              <Label htmlFor="new-book-target-words">目标字数</Label>
              <Input
                id="new-book-target-words"
                type="number"
                value={targetWords}
                onChange={(event) => setTargetWords(Number(event.target.value))}
              />
            </div>
            <Button type="submit" disabled={!canSubmit} className="w-fit">
              开始写作
            </Button>
          </CardContent>
        </form>
      </Card>
    </section>
  );
}
