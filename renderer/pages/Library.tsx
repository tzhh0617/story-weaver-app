import type { BookExportFormat, SchedulerStatus } from '../../src/shared/contracts';
import BookCard from '../components/BookCard';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import BookDetail from './BookDetail';
import type { BookDetailData } from '../types/book-detail';

type LibraryBook = {
  id: string;
  title: string;
  status: string;
  targetWords: number;
  progress?: number;
  completedChapters?: number;
  totalChapters?: number;
};

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function Library({
  books,
  scheduler,
  selectedBookId,
  selectedBookDetail,
  onSelectBook,
  onStartAll,
  onPauseAll,
  onResume,
  onRestart,
  onPause,
  onWriteNext,
  onWriteAll,
  onExport,
  onDelete,
}: {
  books: LibraryBook[];
  scheduler: SchedulerStatus;
  selectedBookId: string | null;
  selectedBookDetail: BookDetailData | null;
  onSelectBook: (bookId: string) => void;
  onStartAll: () => void;
  onPauseAll: () => void;
  onResume: () => void;
  onRestart: () => void;
  onPause: () => void;
  onWriteNext: () => void;
  onWriteAll: () => void;
  onExport: (format: BookExportFormat) => void;
  onDelete: () => void;
}) {
  const completedCount = books.filter((book) => book.status === 'completed').length;
  const hasRunnableBooks = books.some(
    (book) => book.status !== 'completed' && book.status !== 'paused'
  );
  const hasPausableBooks = books.some(
    (book) => book.status !== 'completed' && book.status !== 'paused'
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="grid gap-6 content-start">
        <Card className="rounded-2xl shadow-none">
          <CardHeader className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">作品</p>
              <CardTitle>列表总览</CardTitle>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="完成" value={completedCount} />
              <MetricCard label="写作中" value={scheduler.runningBookIds.length} />
              <MetricCard label="排队" value={scheduler.queuedBookIds.length} />
              <MetricCard label="已暂停" value={scheduler.pausedBookIds.length} />
            </div>
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
            <p className="text-sm text-muted-foreground">
              {`${completedCount}/50 完成 | ${scheduler.runningBookIds.length} 写作中 | ${scheduler.queuedBookIds.length} 排队 | ${scheduler.pausedBookIds.length} 已暂停`}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea
              aria-label="作品列表"
              className="h-[min(60vh,48rem)] pr-3 xl:h-[calc(100vh-24rem)]"
            >
              <div className="grid gap-3">
                {books.length ? (
                  books.map((book) => (
                    <BookCard
                      key={book.id}
                      id={book.id}
                      title={book.title}
                      status={book.status}
                      progress={book.progress ?? 0}
                      completedChapters={book.completedChapters}
                      totalChapters={book.totalChapters}
                      selected={book.id === selectedBookId}
                      onView={onSelectBook}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="暂无作品"
                    description="还没有作品，先创建第一本书。"
                  />
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {selectedBookDetail ? (
        <BookDetail
          book={{
            title: selectedBookDetail.book?.title ?? 'Unknown Book',
            status: selectedBookDetail.book?.status ?? 'error',
            wordCount: selectedBookDetail.chapters.reduce(
              (sum, chapter) => sum + chapter.wordCount,
              0
            ),
          }}
          context={selectedBookDetail.context}
          latestScene={selectedBookDetail.latestScene}
          characterStates={selectedBookDetail.characterStates}
          plotThreads={selectedBookDetail.plotThreads}
          progress={selectedBookDetail.progress}
          onResume={onResume}
          onRestart={onRestart}
          chapters={selectedBookDetail.chapters.map((chapter) => ({
            id: `${chapter.volumeIndex}-${chapter.chapterIndex}`,
            volumeIndex: chapter.volumeIndex,
            chapterIndex: chapter.chapterIndex,
            title:
              chapter.title ??
              `Chapter ${chapter.volumeIndex}.${chapter.chapterIndex}`,
            wordCount: chapter.wordCount,
            status: chapter.content ? 'done' : 'queued',
            content: chapter.content,
            summary: chapter.summary,
          }))}
          onPause={onPause}
          onWriteNext={onWriteNext}
          onWriteAll={onWriteAll}
          onExport={onExport}
          onDelete={onDelete}
        />
      ) : (
        <EmptyState
          title="暂无作品详情"
          description="从左侧列表选择一本书，或者先创建第一本作品。"
        />
      )}
    </div>
  );
}
