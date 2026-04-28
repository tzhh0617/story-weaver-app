import { useState } from 'react';
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
    <section className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">新建作品</h2>
        <p className="text-sm text-muted-foreground">
          输入故事钩子、核心冲突或主角目标，开始一条新的长篇创作线。
        </p>
      </div>
      <Card className="rounded-2xl shadow-none">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              return;
            }

            onCreate({ idea, targetWords });
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle>创作参数</CardTitle>
            <CardDescription>
              先给出故事起点，剩下的世界观、大纲和章节会继续自动推进。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="new-book-idea">IDEA</Label>
              <Textarea
                id="new-book-idea"
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
