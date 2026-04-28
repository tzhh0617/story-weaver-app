import ProgressBar from './ProgressBar';
import StatusBadge from './StatusBadge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export default function BookCard({
  id,
  title,
  status,
  progress,
  completedChapters,
  totalChapters,
  onView,
}: {
  id: string;
  title: string;
  status: string;
  progress: number;
  completedChapters?: number;
  totalChapters?: number;
  onView?: (bookId: string) => void;
}) {
  return (
    <Card className="border-border/70 bg-card/95 p-5">
      <CardHeader className="flex flex-row items-start justify-between gap-4 p-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent className="grid gap-4 p-0">
        <ProgressBar value={progress} />
        {typeof totalChapters === 'number' && totalChapters > 0 ? (
          <p className="m-0 text-sm text-muted-foreground">{`${completedChapters ?? 0}/${totalChapters} 章 · ${progress}%`}</p>
        ) : null}
        {onView ? (
          <div className="mt-1">
            <Button type="button" variant="secondary" onClick={() => onView(id)}>
              查看详情
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
