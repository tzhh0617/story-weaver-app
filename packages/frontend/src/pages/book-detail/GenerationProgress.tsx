import { useEffect, useRef } from 'react';
import type { ExecutionLogRecord } from '@story-weaver/shared/contracts';
import { Badge } from '../../components/ui/badge';
import {
  layoutCardClassName,
} from '../../components/ui/card';
import { ScrollArea } from '../../components/ui/scroll-area';
import {
  executionLogLevelLabels,
  getExecutionEventLabel,
  getExecutionPhaseLabel,
  getExecutionLogLevelClassName,
  getExecutionLogLevelIcon,
} from '../../execution-log-format';
import { maxWritingActivityItems } from './types';

function formatLogDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

export type GenerationProgressProps = {
  logs: ExecutionLogRecord[];
};

export default function GenerationProgress({ logs }: GenerationProgressProps) {
  const latestLogRef = useRef<HTMLDivElement | null>(null);
  const visibleLogs = logs.slice(-maxWritingActivityItems);

  useEffect(() => {
    latestLogRef.current?.scrollIntoView({ block: 'end' });
  }, [logs.length]);

  return (
    <aside
      aria-label="写作动态面板"
      className={`${layoutCardClassName} grid h-56 min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          写作动态
        </h2>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {`${visibleLogs.length} 条`}
        </span>
      </header>
      <div className="min-h-0">
        {visibleLogs.length ? (
          <ScrollArea
            aria-label="写作动态滚动区"
            className="h-full min-h-0 px-4 py-3"
          >
            <div className="grid content-start gap-3 pr-2">
              {visibleLogs.map((log) => {
                const Icon = getExecutionLogLevelIcon(log.level);

                return (
                  <article
                    key={log.id}
                    className="grid gap-1 border-l-2 border-border/70 pl-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`h-5 px-1.5 text-[0.68rem] ${getExecutionLogLevelClassName(log.level)}`}
                      >
                        <Icon className="mr-1 size-3" />
                        {executionLogLevelLabels[log.level]}
                      </Badge>
                      <time className="ml-auto shrink-0 text-[0.68rem] font-medium text-muted-foreground">
                        {formatLogDate(log.createdAt)}
                      </time>
                    </div>
                    <p className="line-clamp-2 leading-5 text-foreground">
                      {log.message}
                    </p>
                    <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{getExecutionEventLabel(log.eventType)}</span>
                      {log.phase ? (
                        <span>{getExecutionPhaseLabel(log.phase)}</span>
                      ) : null}
                      {log.chapterIndex ? (
                        <span>{`第 ${log.chapterIndex} 章`}</span>
                      ) : null}
                    </p>
                    {log.errorMessage ? (
                      <p className="line-clamp-2 text-xs leading-5 text-destructive">
                        {log.errorMessage}
                      </p>
                    ) : null}
                  </article>
                );
              })}
              <div ref={latestLogRef} aria-hidden="true" />
            </div>
          </ScrollArea>
        ) : (
          <div
            role="status"
            className="flex h-full min-h-32 items-center px-5 text-sm leading-6 text-muted-foreground"
          >
            等待当前作品的写作动态...
          </div>
        )}
      </div>
    </aside>
  );
}
