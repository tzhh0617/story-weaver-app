import { useState } from 'react';
import type { SchedulerStatus } from '../../src/shared/contracts';
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
import { getStatusLabel } from '../status-labels';

type LibraryBook = {
  id: string;
  title: string;
  idea: string;
  status: string;
  targetWords: number;
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
  const hasRunnableBooks = books.some(
    (book) => book.status !== 'completed' && book.status !== 'paused'
  );
  const hasPausableBooks = books.some(
    (book) => book.status !== 'completed' && book.status !== 'paused'
  );
  const shelfStats = [
    { label: '完成', value: `${completedCount}/50` },
    { label: '写作中', value: scheduler.runningBookIds.length },
    { label: '排队', value: scheduler.queuedBookIds.length },
    { label: '已暂停', value: scheduler.pausedBookIds.length },
  ];
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleBooks = normalizedSearchQuery
    ? books.filter((book) =>
        [
          book.title,
          book.idea,
          book.status,
          getStatusLabel(book.status),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearchQuery)
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
      <div className={`grid gap-5 px-5 py-5 ${layoutCardClassName}`}>
        <div className="flex flex-wrap gap-3">
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
        <div className="grid gap-3 rounded-lg border border-border/70 bg-background/65 p-3">
          <Input
            aria-label="搜索作品"
            placeholder="搜索作品、设定或状态"
            className="min-w-0"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
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
      </div>

      <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
        {visibleBooks.length ? (
          visibleBooks.map((book) => (
            <BookCard
              key={book.id}
              id={book.id}
              title={book.title}
              idea={book.idea}
              status={book.status}
              progress={book.progress ?? 0}
              targetWords={book.targetWords}
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
              description="换一个关键词试试。搜索会匹配作品标题、简介和状态。"
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
    </section>
  );
}
