import { Search } from 'lucide-react';
import { useState } from 'react';
import type { SchedulerStatus } from '@story-weaver/shared/contracts';
import BookCard from '../components/BookCard';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  layoutCardClassName,
  pageIntroDescriptionClassName,
  pageIntroEyebrowClassName,
  pageIntroPanelClassName,
  pageIntroTitleClassName,
} from '../components/ui/card';

type LibraryBook = {
  id: string;
  title: string;
  idea: string;
  status: string;
  targetChapters: number;
  wordsPerChapter: number;
  createdAt: string;
  updatedAt: string;
  progress?: number;
  completedChapters?: number;
  totalChapters?: number;
};

export default function Library({
  books,
  scheduler,
  onSelectBook,
  onCreateBook,
  onStartAll,
  onPauseAll,
}: {
  books: LibraryBook[];
  scheduler: SchedulerStatus;
  onSelectBook: (bookId: string) => void;
  onCreateBook?: () => void;
  onStartAll: () => void;
  onPauseAll: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const completedCount = books.filter((book) => book.status === 'completed').length;
  const runningBookIds = new Set(scheduler.runningBookIds);
  const pausedBookIds = new Set(scheduler.pausedBookIds);
  const writingCount = new Set([
    ...scheduler.runningBookIds,
    ...books
      .filter((book) => book.status === 'writing' || runningBookIds.has(book.id))
      .map((book) => book.id),
  ]).size;
  const pausedCount = new Set([
    ...scheduler.pausedBookIds,
    ...books
      .filter((book) => book.status === 'paused' || pausedBookIds.has(book.id))
      .map((book) => book.id),
  ]).size;
  const hasRunnableBooks = books.some(
    (book) => book.status !== 'completed' && book.status !== 'paused'
  );
  const hasPausableBooks = books.some(
    (book) => book.status !== 'completed' && book.status !== 'paused'
  );
  const shelfStats = [
    { label: '完成', value: `${completedCount}/${books.length}` },
    { label: '写作中', value: writingCount },
    { label: '排队', value: scheduler.queuedBookIds.length },
    { label: '已暂停', value: pausedCount },
  ];
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleBooks = normalizedSearchQuery
    ? books.filter((book) =>
        book.title.toLowerCase().includes(normalizedSearchQuery)
      )
    : books;

  return (
    <section className="grid gap-6">
      <header data-testid="library-intro-panel" className={pageIntroPanelClassName}>
        <p className={pageIntroEyebrowClassName}>Story Library / Archive</p>
        <h1 className={pageIntroTitleClassName}>作品库</h1>
        <p className={pageIntroDescriptionClassName}>
          像整理一排正在写作的书脊一样管理作品：先看状态、进度和最近更新时间，再进入单本作品继续深写。
        </p>
      </header>
      <div
        data-testid="library-workspace-card"
        className={`grid gap-5 px-5 py-5 ${layoutCardClassName}`}
      >
        <div
          data-testid="library-toolbar"
          className="flex flex-wrap items-center gap-3"
        >
          <div className="relative w-full sm:max-w-64">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="按标题搜索作品"
              placeholder="按标题搜索"
              className="h-9 min-w-0 pl-8 sm:max-w-64"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div
            data-testid="library-actions"
            className="flex flex-wrap items-center gap-3 sm:ml-auto"
          >
            <Button type="button" onClick={onCreateBook}>
              新建作品
            </Button>
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
        </div>
        <dl className="grid grid-cols-2 gap-2 border-t border-border/70 pt-4 sm:grid-cols-4">
          {shelfStats.map((item) => (
            <div
              key={item.label}
              className="rounded-md border border-border/70 bg-background/55 px-3 py-2"
            >
              <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-5 border-t border-border/70 pt-5 xl:grid-cols-2 2xl:grid-cols-3">
          {visibleBooks.length ? (
            visibleBooks.map((book) => (
              <BookCard
                key={book.id}
                id={book.id}
                title={book.title}
                idea={book.idea}
                status={book.status}
                progress={book.progress ?? 0}
                targetChapters={book.targetChapters}
                wordsPerChapter={book.wordsPerChapter}
                updatedAt={book.updatedAt}
                completedChapters={book.completedChapters}
                totalChapters={book.totalChapters}
                onView={onSelectBook}
              />
            ))
          ) : books.length ? (
            <div className="xl:col-span-2 2xl:col-span-3">
              <EmptyState
                title="没有匹配作品"
                description="换一个标题关键词试试。搜索仅匹配作品标题。"
              />
            </div>
          ) : (
            <div className="xl:col-span-2 2xl:col-span-3">
              <EmptyState
                title="暂无作品"
                description="这排书架还空着。创建第一本作品后，它会以书卡形式出现在这里，并显示章节进度、写作状态和最近更新。"
                actionLabel="新建第一本作品"
                onAction={onCreateBook}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
