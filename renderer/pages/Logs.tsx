import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, ListFilter, Search } from 'lucide-react';
import type {
  ExecutionLogLevel,
  ExecutionLogRecord,
} from '../../src/shared/contracts';
import { Badge } from '../components/ui/badge';
import {
  layoutCardClassName,
  pageIntroDescriptionClassName,
  pageIntroEyebrowClassName,
  pageIntroPanelClassName,
  pageIntroTitleClassName,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const levelLabels: Record<ExecutionLogLevel, string> = {
  info: '信息',
  success: '成功',
  error: '错误',
};

const eventLabels: Record<string, string> = {
  scheduler_start_all: '批量开始',
  scheduler_pause_all: '批量暂停',
  book_queued: '加入队列',
  book_started: '开始执行',
  book_paused: '暂停执行',
  book_resumed: '恢复执行',
  book_restarted: '重新执行',
  book_write_next: '手动下一章',
  book_write_all: '手动写完',
  book_progress: '阶段进度',
  chapter_completed: '章节完成',
  book_completed: '执行完成',
  book_failed: '执行失败',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function getLevelIcon(level: ExecutionLogLevel) {
  if (level === 'success') {
    return CheckCircle2;
  }

  if (level === 'error') {
    return AlertCircle;
  }

  return Info;
}

function getLevelClassName(level: ExecutionLogLevel) {
  if (level === 'success') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
  }

  if (level === 'error') {
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  }

  return 'border-primary/25 bg-primary/10 text-primary';
}

export default function Logs({
  logs,
  books,
}: {
  logs: ExecutionLogRecord[];
  books: Array<{
    id: string;
    title: string;
  }>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [level, setLevel] = useState<ExecutionLogLevel | 'all'>('all');
  const [eventType, setEventType] = useState('all');
  const [bookId, setBookId] = useState('all');
  const latestLogRef = useRef<HTMLDivElement | null>(null);
  const eventTypes = Array.from(new Set(logs.map((log) => log.eventType))).sort();
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleLogs = logs
    .filter((log) => (bookId === 'all' ? true : log.bookId === bookId))
    .filter((log) => (level === 'all' ? true : log.level === level))
    .filter((log) => (eventType === 'all' ? true : log.eventType === eventType))
    .filter((log) =>
      normalizedSearchQuery
        ? [
            log.bookTitle,
            log.message,
            log.errorMessage,
            log.eventType,
            eventLabels[log.eventType],
            log.phase,
          ]
            .filter(Boolean)
            .some((value) =>
              value!.toLowerCase().includes(normalizedSearchQuery)
            )
        : true
    );

  useEffect(() => {
    latestLogRef.current?.scrollIntoView({ block: 'end' });
  }, [logs.length]);

  return (
    <section className="grid gap-6">
      <header data-testid="logs-intro-panel" className={pageIntroPanelClassName}>
        <p className={pageIntroEyebrowClassName}>Execution Records</p>
        <h1 className={pageIntroTitleClassName}>后台日志</h1>
        <p className={pageIntroDescriptionClassName}>
          查看后台写作、调度和章节生成过程留下的执行记录。
        </p>
      </header>

      <div className={`grid gap-5 px-5 py-5 ${layoutCardClassName}`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="execution-log-book">书本</Label>
            <select
              id="execution-log-book"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={bookId}
              onChange={(event) => setBookId(event.target.value)}
            >
              <option value="all">全部书本</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid min-w-60 gap-2">
            <Label htmlFor="execution-log-search">搜索日志</Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="execution-log-search"
                aria-label="搜索日志"
                className="h-10 pl-8"
                placeholder="书名、消息、错误"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="execution-log-level">日志级别</Label>
            <select
              id="execution-log-level"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={level}
              onChange={(event) =>
                setLevel(event.target.value as ExecutionLogLevel | 'all')
              }
            >
              <option value="all">全部级别</option>
              <option value="info">信息</option>
              <option value="success">成功</option>
              <option value="error">错误</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="execution-log-event-type">事件类型</Label>
            <select
              id="execution-log-event-type"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
            >
              <option value="all">全部事件</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {eventLabels[type] ?? type}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2 rounded-md border border-border/70 bg-background/55 px-3 py-2 text-sm text-muted-foreground">
            <ListFilter className="size-4" />
            <span>{visibleLogs.length} 条记录</span>
          </div>
        </div>

        {visibleLogs.length ? (
          <div role="list" aria-label="后台执行日志" className="grid gap-3">
            {visibleLogs.map((log) => {
              const Icon = getLevelIcon(log.level);

              return (
                <article
                  key={log.id}
                  role="listitem"
                  className="grid gap-3 rounded-lg border border-border/75 bg-background/72 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={getLevelClassName(log.level)}
                    >
                      <Icon className="mr-1 size-3.5" />
                      {levelLabels[log.level]}
                    </Badge>
                    <Badge variant="secondary">
                      {eventLabels[log.eventType] ?? log.eventType}
                    </Badge>
                    {log.bookTitle ? (
                      <span className="text-sm font-medium text-foreground">
                        {log.bookTitle}
                      </span>
                    ) : null}
                    <time className="ml-auto text-xs text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </time>
                  </div>

                  <div className="grid gap-1">
                    <p className="text-sm font-medium leading-6 text-foreground">
                      {log.message}
                    </p>
                    {log.errorMessage ? (
                      <p className="text-sm leading-6 text-destructive">
                        {log.errorMessage}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {[
                        log.phase ? `阶段：${log.phase}` : null,
                        log.chapterIndex ? `第 ${log.chapterIndex} 章` : null,
                      ]
                        .filter(Boolean)
                        .join(' / ')}
                    </p>
                  </div>
                </article>
              );
            })}
            <div ref={latestLogRef} aria-hidden="true" />
          </div>
        ) : (
          <div
            role="status"
            className="rounded-lg border border-dashed border-border/80 bg-background/55 px-5 py-10 text-center"
          >
            <h3 className="text-lg font-semibold">
              {logs.length ? '暂无匹配日志' : '暂无实时日志'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {logs.length
                ? '调整书本、级别、事件类型或关键词后再试。'
                : '开始写作或批量调度后，这里会显示实时执行记录。'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
