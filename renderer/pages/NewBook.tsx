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
const cadenceOptions = [
  { value: 'fast', label: '快节奏' },
  { value: 'steady', label: '稳定兑现' },
  { value: 'slow_burn', label: '慢热蓄力' },
  { value: 'suppressed_then_burst', label: '压抑后爆发' },
] as const;

type ViralStrategyInput = {
  readerPayoff?: string;
  protagonistDesire?: string;
  cadenceMode?: (typeof cadenceOptions)[number]['value'];
  antiClicheDirection?: string;
};

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
    viralStrategy?: ViralStrategyInput;
  }) => void | Promise<void>;
}) {
  const [idea, setIdea] = useState('');
  const [targetChapters, setTargetChapters] = useState(500);
  const [wordsPerChapter, setWordsPerChapter] = useState(2500);
  const [readerPayoff, setReaderPayoff] = useState('');
  const [protagonistDesire, setProtagonistDesire] = useState('');
  const [cadenceMode, setCadenceMode] = useState<
    ViralStrategyInput['cadenceMode'] | ''
  >('');
  const [antiClicheDirection, setAntiClicheDirection] = useState('');
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

            const viralStrategy: ViralStrategyInput = {};
            const trimmedReaderPayoff = readerPayoff.trim();
            const trimmedProtagonistDesire = protagonistDesire.trim();
            const trimmedAntiClicheDirection = antiClicheDirection.trim();

            if (trimmedReaderPayoff) {
              viralStrategy.readerPayoff = trimmedReaderPayoff;
            }

            if (trimmedProtagonistDesire) {
              viralStrategy.protagonistDesire = trimmedProtagonistDesire;
            }

            if (cadenceMode) {
              viralStrategy.cadenceMode = cadenceMode;
            }

            if (trimmedAntiClicheDirection) {
              viralStrategy.antiClicheDirection = trimmedAntiClicheDirection;
            }

            const result = onCreate({
              idea,
              targetChapters,
              wordsPerChapter,
              ...(Object.keys(viralStrategy).length ? { viralStrategy } : {}),
            });

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
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="new-book-reader-payoff">读者爽点</Label>
                <Input
                  id="new-book-reader-payoff"
                  value={readerPayoff}
                  onChange={(event) => setReaderPayoff(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-book-protagonist-desire">主角欲望</Label>
                <Input
                  id="new-book-protagonist-desire"
                  value={protagonistDesire}
                  onChange={(event) =>
                    setProtagonistDesire(event.target.value)
                  }
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="new-book-cadence-mode">节奏偏好</Label>
                <select
                  id="new-book-cadence-mode"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                  value={cadenceMode}
                  onChange={(event) =>
                    setCadenceMode(
                      event.target.value as ViralStrategyInput['cadenceMode'] | ''
                    )
                  }
                >
                  <option value="">自动判断</option>
                  {cadenceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-book-anti-cliche-direction">
                  反套路方向
                </Label>
                <Input
                  id="new-book-anti-cliche-direction"
                  value={antiClicheDirection}
                  onChange={(event) =>
                    setAntiClicheDirection(event.target.value)
                  }
                />
              </div>
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
