import type { SchedulerStatus } from '../../src/shared/contracts';
import BookCard from '../components/BookCard';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export default function Dashboard({
  books,
  scheduler,
  onSelectBook,
  onStartAll,
  onPauseAll,
}: {
  books: Array<{
    id: string;
    title: string;
    status: string;
    targetWords: number;
    progress?: number;
    completedChapters?: number;
    totalChapters?: number;
  }>;
  scheduler: SchedulerStatus;
  onSelectBook?: (bookId: string) => void;
  onStartAll?: () => void;
  onPauseAll?: () => void;
}) {
  const completedCount = books.filter((book) => book.status === 'completed').length;
  const hasRunnableBooks = books.some(
    (book) => book.status !== 'completed' && book.status !== 'paused'
  );
  const hasPausableBooks = books.some(
    (book) => book.status !== 'completed' && book.status !== 'paused'
  );

  return (
    <section className="dashboard-panel grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/70 bg-card/95">
          <CardContent className="grid gap-1 p-5">
            <p className="text-sm text-muted-foreground">完成</p>
            <p className="text-2xl font-semibold">{completedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95">
          <CardContent className="grid gap-1 p-5">
            <p className="text-sm text-muted-foreground">写作中</p>
            <p className="text-2xl font-semibold">{scheduler.runningBookIds.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95">
          <CardContent className="grid gap-1 p-5">
            <p className="text-sm text-muted-foreground">排队</p>
            <p className="text-2xl font-semibold">{scheduler.queuedBookIds.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95">
          <CardContent className="grid gap-1 p-5">
            <p className="text-sm text-muted-foreground">已暂停</p>
            <p className="text-2xl font-semibold">{scheduler.pausedBookIds.length}</p>
          </CardContent>
        </Card>
      </div>
      <Card className="border-border/70 bg-card/95 p-7">
        <CardHeader className="flex flex-col gap-4 p-0 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>书架总览</CardTitle>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={onStartAll} disabled={!hasRunnableBooks}>
              全部开始
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onPauseAll}
              disabled={!hasPausableBooks}
            >
              全部暂停
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 p-0">
          <p className="m-0 text-sm text-muted-foreground">{`${completedCount}/50 完成 | ${scheduler.runningBookIds.length} 写作中 | ${scheduler.queuedBookIds.length} 排队 | ${scheduler.pausedBookIds.length} 已暂停`}</p>
          <div className="grid gap-4">
            {books.length === 0 ? (
              <EmptyState
                title="暂无作品"
                description="还没有作品，先创建第一本书。"
              />
            ) : null}
            {books.map((book) => (
              <BookCard
                key={book.id}
                id={book.id}
                title={book.title}
                status={book.status}
                progress={book.progress ?? 0}
                completedChapters={book.completedChapters}
                totalChapters={book.totalChapters}
                onView={onSelectBook}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
