import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
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
    <Card className="border-border/70 bg-card/95 p-7 shadow-panel">
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
        <CardHeader className="p-0">
          <CardTitle>新建作品</CardTitle>
          <CardDescription>
            输入故事钩子、核心冲突或主角目标，开始一条新的长篇创作线。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-0">
          <label className="grid gap-2 font-medium">
            IDEA
            <Textarea
              aria-label="IDEA"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
            />
          </label>
          <label className="grid gap-2 font-medium">
            目标字数
            <Input
              aria-label="目标字数"
              type="number"
              value={targetWords}
              onChange={(event) => setTargetWords(Number(event.target.value))}
            />
          </label>
          <Button type="submit" disabled={!canSubmit}>
            开始写作
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
