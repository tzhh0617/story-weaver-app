import { useEffect, useRef, useState } from 'react';
import {
  Download,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type {
  BookExportFormat,
  ExecutionLogRecord,
} from '../../src/shared/contracts';
import ChapterList from '../components/ChapterList';
import { Badge } from '../components/ui/badge';
import {
  layoutCardClassName,
  layoutCardSectionClassName,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import ProgressBar from '../components/ProgressBar';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  executionLogLevelLabels,
  getExecutionLogLevelClassName,
  getExecutionLogLevelIcon,
} from '../execution-log-format';
import { getStatusLabel } from '../status-labels';
import { formatTotalWordCount } from '../word-count-format';

type ContextTab = 'outline' | 'characters' | 'threads';

function formatLogDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function getEmptyChapterMessage(phase: string) {
  if (phase === 'planning_chapters') {
    return '正在规划章节...';
  }

  if (
    phase === 'naming_title' ||
    phase === 'creating' ||
    phase === 'building_world' ||
    phase === 'building_outline'
  ) {
    return '等待章节规划...';
  }

  return '暂无章节内容';
}

function getEmptyOutlineMessage(phase: string) {
  if (phase === 'naming_title') {
    return '正在生成书名...';
  }

  if (phase === 'creating') {
    return '正在创建书本...';
  }

  if (phase === 'building_world') {
    return '正在生成世界观...';
  }

  if (phase === 'building_outline') {
    return '正在生成大纲...';
  }

  if (phase === 'planning_chapters') {
    return '正在规划章节...';
  }

  return '暂无大纲信息';
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={layoutCardSectionClassName}>
      <div className="mb-3">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

function BookProgressPanel({
  phase,
  stepLabel,
  completedChapters,
  totalChapters,
}: {
  phase: string;
  stepLabel?: string | null;
  completedChapters: number;
  totalChapters: number;
}) {
  const chapterProgressLabel = totalChapters
    ? `已完成 ${completedChapters} / ${totalChapters} 章`
    : '章节规划生成后会显示总进度';
  const progressPercent = totalChapters
    ? Math.round((completedChapters / totalChapters) * 100)
    : 0;

  return (
    <section
      aria-label="进度面板"
      className={`${layoutCardClassName} grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden`}
    >
      <header className="border-b border-border/60 px-5 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          进度
        </h2>
      </header>
      <div className="grid gap-3 px-5 py-4 text-sm leading-6 text-muted-foreground">
        <p className="font-medium text-foreground">
          {stepLabel || getStatusLabel(phase)}
        </p>
        <p>{chapterProgressLabel}</p>
        {totalChapters ? (
          <div className="grid gap-2 pt-1">
            <ProgressBar value={progressPercent} />
            <p className="text-xs font-medium text-foreground">
              {`${progressPercent}%`}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RealtimeLogPanel({ logs }: { logs: ExecutionLogRecord[] }) {
  const latestLogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    latestLogRef.current?.scrollIntoView({ block: 'end' });
  }, [logs.length]);

  return (
    <aside
      aria-label="实时日志面板"
      className={`${layoutCardClassName} grid h-56 min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          实时日志
        </h2>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {`${logs.length} 条`}
        </span>
      </header>
      <div className="min-h-0">
        {logs.length ? (
          <ScrollArea
            aria-label="实时日志滚动区"
            className="h-full min-h-0 px-4 py-3"
          >
            <div className="grid content-start gap-3 pr-2">
              {logs.map((log) => {
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
                      {log.phase ? (
                        <span>{getStatusLabel(log.phase)}</span>
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
            等待当前书本的实时记录...
          </div>
        )}
      </div>
    </aside>
  );
}

function ChapterOverview({
  totalChapters,
  completedChapters,
}: {
  totalChapters: number;
  completedChapters: number;
}) {
  const progressLabel = `${completedChapters} / ${totalChapters}`;

  return (
    <div
      aria-label="章节列表标题"
      className="flex items-center justify-between gap-3 text-sm"
    >
      <h2 className="font-semibold tracking-tight text-foreground">章节</h2>
      <span className="text-xs font-semibold text-muted-foreground">
        {progressLabel}
      </span>
    </div>
  );
}

function DetailEmpty({
  message,
  testId,
}: {
  message: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="border-l-2 border-dashed border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
    >
      <p>{message}</p>
    </div>
  );
}

export default function BookDetail({
  book,
  context,
  latestScene,
  characterStates,
  plotThreads,
  chapters,
  progress,
  liveOutput,
  executionLogs = [],
  onBackToLibrary,
  onPause,
  onResume,
  onRestart,
  onExport,
  onDelete,
}: {
  book: { title: string; status: string; wordCount: number };
  context?: {
    worldSetting?: string | null;
    outline?: string | null;
  } | null;
  latestScene?: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events: string | null;
  } | null;
  characterStates?: Array<{
    characterId: string;
    characterName: string;
    volumeIndex: number;
    chapterIndex: number;
    location: string | null;
    status: string | null;
    knowledge: string | null;
    emotion: string | null;
    powerLevel: string | null;
  }>;
  plotThreads?: Array<{
    id: string;
    description: string;
    plantedAt: number;
    expectedPayoff: number | null;
    resolvedAt: number | null;
    importance: string;
  }>;
  chapters?: Array<{
    id?: string;
    volumeIndex?: number;
    chapterIndex?: number;
    title: string;
    wordCount: number;
    status: 'done' | 'writing' | 'queued';
    content?: string | null;
    summary?: string | null;
    outline?: string | null;
    auditScore?: number | null;
    draftAttempts?: number;
  }>;
  progress?: {
    phase?: string | null;
    stepLabel?: string | null;
    currentVolume?: number | null;
    currentChapter?: number | null;
  } | null;
  liveOutput?: {
    volumeIndex: number;
    chapterIndex: number;
    title: string;
    content: string;
  } | null;
  executionLogs?: ExecutionLogRecord[];
  onBackToLibrary?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onExport?: (format: BookExportFormat) => void;
  onDelete?: () => void;
}) {
  const renderedChapters =
    chapters?.map((chapter, index) => ({
      id:
        chapter.id ??
        `${chapter.volumeIndex ?? 0}-${chapter.chapterIndex ?? 0}`,
      title: chapter.title,
      volumeIndex: chapter.volumeIndex,
      chapterIndex: chapter.chapterIndex,
      displayIndex: index + 1,
      wordCount: chapter.wordCount,
      status: chapter.status,
      content: chapter.content,
      summary: chapter.summary,
      outline: chapter.outline,
      auditScore: chapter.auditScore,
      draftAttempts: chapter.draftAttempts,
    })) ?? [];
  const [contextTab, setContextTab] = useState<ContextTab>('outline');
  const activeChapterId =
    progress?.currentVolume && progress?.currentChapter
      ? `${progress.currentVolume}-${progress.currentChapter}`
      : liveOutput
        ? `${liveOutput.volumeIndex}-${liveOutput.chapterIndex}`
        : null;
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    activeChapterId ?? renderedChapters[0]?.id ?? null
  );
  const shouldAutoFollowActiveChapterRef = useRef(true);
  const liveOutputEndRef = useRef<HTMLDivElement | null>(null);
  const hasOutlineContent = Boolean(context?.worldSetting || context?.outline);
  const currentPhase = progress?.phase ?? book.status;
  const totalWordCountText = formatTotalWordCount(book.wordCount);
  const completedChapters = renderedChapters.filter(
    (chapter) => chapter.status === 'done'
  ).length;
  const totalChapters = renderedChapters.length;
  const hasGeneratedContent = Boolean(
    chapters?.some((chapter) => chapter.content && chapter.content.trim().length > 0)
  );
  const canPause = currentPhase !== 'paused' && currentPhase !== 'completed';
  const canResume = currentPhase === 'paused';
  const selectedChapter =
    renderedChapters.find((chapter) => chapter.id === selectedChapterId) ??
    renderedChapters[0] ??
    null;
  const selectedHasLiveOutput =
    selectedChapter &&
    liveOutput &&
    selectedChapter.volumeIndex === liveOutput.volumeIndex &&
    selectedChapter.chapterIndex === liveOutput.chapterIndex &&
    liveOutput.content.trim().length > 0;
  const selectedContent = selectedHasLiveOutput
    ? null
    : selectedChapter?.content;
  const readingPanelTitle =
    typeof selectedChapter?.chapterIndex === 'number'
      ? `第 ${selectedChapter.chapterIndex} 章 正文`
      : '正文';
  const selectedAuditScore =
    typeof selectedChapter?.auditScore === 'number'
      ? selectedChapter.auditScore
      : null;
  useEffect(() => {
    if (activeChapterId) {
      if (shouldAutoFollowActiveChapterRef.current) {
        setSelectedChapterId(activeChapterId);
      }
      return;
    }

    setSelectedChapterId((current) => {
      if (
        current &&
        renderedChapters.some((chapter) => chapter.id === current)
      ) {
        return current;
      }

      return renderedChapters[0]?.id ?? null;
    });
  }, [activeChapterId, renderedChapters]);

  useEffect(() => {
    if (!selectedHasLiveOutput || !liveOutput?.content) {
      return;
    }

    if (typeof liveOutputEndRef.current?.scrollIntoView !== 'function') {
      return;
    }

    liveOutputEndRef.current.scrollIntoView({
      block: 'end',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [liveOutput?.content, selectedHasLiveOutput]);

  return (
    <section
      data-testid="book-detail-workbench"
      className="grid h-full min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden"
    >
      <header
        data-testid="book-detail-topbar"
        className="grid gap-4 border-b border-border/60 bg-background/35 px-1 pb-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end"
      >
        <div className="min-w-0">
          {onBackToLibrary ? (
            <button
              type="button"
              className="mb-2 w-fit text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
              onClick={onBackToLibrary}
            >
              返回作品库
            </button>
          ) : null}
          <h1
            data-testid="book-detail-title"
            aria-label={`${book.title}（${getStatusLabel(progress?.phase ?? book.status)} · ${totalWordCountText}）`}
            className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 break-words text-2xl font-semibold leading-tight tracking-tight"
          >
            <span className="min-w-0">{book.title}</span>
            <span className="text-xl font-medium text-muted-foreground">
              {`（${getStatusLabel(progress?.phase ?? book.status)} · ${totalWordCountText}）`}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 xl:max-w-[52rem] xl:justify-end">
          <Button type="button" size="sm" variant="secondary" onClick={onPause} disabled={!canPause}>
            <Pause aria-hidden="true" />
            暂停
          </Button>
          <Button type="button" size="sm" onClick={onResume} disabled={!canResume}>
            <Play aria-hidden="true" />
            恢复写作
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onRestart}>
            <RotateCcw aria-hidden="true" />
            重新开始
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onExport?.('txt')}
            disabled={!hasGeneratedContent}
          >
            <Download aria-hidden="true" />
            导出 TXT
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            删除作品
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 gap-5 overflow-hidden xl:grid-cols-[18rem_minmax(0,1fr)_21rem]">
        <section
          aria-label="章节面板"
          className={`${layoutCardClassName} grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden`}
        >
          <header className="border-b border-border/60 px-4 py-3">
            <ChapterOverview
              totalChapters={totalChapters}
              completedChapters={completedChapters}
            />
          </header>
          <div className="min-h-0 p-2">
            {renderedChapters.length ? (
              <ScrollArea aria-label="章节滚动区" className="h-full min-h-0 pr-2">
                <ChapterList
                  chapters={renderedChapters}
                  activeChapterId={activeChapterId}
                  selectedChapterId={selectedChapterId}
                  onSelectChapter={(chapterId) => {
                    shouldAutoFollowActiveChapterRef.current = false;
                    setSelectedChapterId(chapterId);
                  }}
                />
              </ScrollArea>
            ) : (
              <ScrollArea aria-label="章节滚动区" className="h-full min-h-0">
                <DetailEmpty message={getEmptyChapterMessage(currentPhase)} />
              </ScrollArea>
            )}
          </div>
        </section>

        <section
          aria-label="正文面板"
          className={`${layoutCardClassName} grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden`}
        >
          <header className="flex min-w-0 items-center gap-3 border-b border-border/60 px-5 py-3">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {readingPanelTitle}
            </h2>
            {selectedAuditScore !== null ? (
              <span className="ml-auto shrink-0 text-xs font-semibold text-muted-foreground">
                {`审校 ${selectedAuditScore}`}
              </span>
            ) : null}
          </header>
          <div data-testid="chapter-stream-pane" className="min-h-0">
            <ScrollArea
              aria-label="正文滚动区"
              data-testid="chapter-reading-pane"
              className="h-full min-h-0 px-4 py-4"
            >
              <div className="grid content-start gap-5 pr-2">
                {selectedHasLiveOutput && liveOutput?.content ? (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                    {liveOutput.content}
                  </p>
                ) : null}
                {selectedContent ? (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                    {selectedContent}
                  </p>
                ) : null}
                <div ref={liveOutputEndRef} aria-hidden="true" />
              </div>
            </ScrollArea>
          </div>
        </section>

        <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-5 overflow-hidden">
          <BookProgressPanel
            phase={currentPhase}
            stepLabel={progress?.stepLabel}
            completedChapters={completedChapters}
            totalChapters={totalChapters}
          />

          <RealtimeLogPanel logs={executionLogs} />

          <aside
            aria-label="上下文面板"
            className={`${layoutCardClassName} grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden`}
          >
            <header className="border-b border-border/60 px-5 py-3">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                上下文
              </h2>
            </header>
            <ScrollArea aria-label="上下文滚动区" className="h-full min-h-0 px-4 py-4">
              <div className="grid content-start gap-4 pr-2">
                {latestScene ? (
                  <DetailSection title="最近场景">
                    <p>{`${latestScene.location} · ${latestScene.timeInStory}`}</p>
                    {latestScene.events ? <p>{latestScene.events}</p> : null}
                  </DetailSection>
                ) : (
                  <DetailEmpty message="暂无场景记录" />
                )}
                <Tabs
                  value={contextTab}
                  onValueChange={(value) => setContextTab(value as ContextTab)}
                  className="grid gap-4"
                >
                  <TabsList className="grid h-9 w-full grid-cols-3 justify-start rounded-none border-b border-border/60 bg-transparent p-0 shadow-none">
                    <TabsTrigger
                      value="outline"
                      className="rounded-none border-b-2 border-transparent bg-transparent px-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      onClick={() => setContextTab('outline')}
                    >
                      大纲
                    </TabsTrigger>
                    <TabsTrigger
                      value="characters"
                      className="rounded-none border-b-2 border-transparent bg-transparent px-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      onClick={() => setContextTab('characters')}
                    >
                      人物
                    </TabsTrigger>
                    <TabsTrigger
                      value="threads"
                      className="rounded-none border-b-2 border-transparent bg-transparent px-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      onClick={() => setContextTab('threads')}
                    >
                      伏笔
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="outline" className="mt-0">
                    <div className="grid content-start gap-4">
                      {context?.worldSetting ? (
                        <DetailSection title="世界观">
                          <p>{context.worldSetting}</p>
                        </DetailSection>
                      ) : null}
                      {context?.outline ? (
                        <DetailSection title="总纲">
                          <p>{context.outline}</p>
                        </DetailSection>
                      ) : null}
                      {!hasOutlineContent ? (
                        <DetailEmpty
                          testId="book-detail-empty-outline"
                          message={getEmptyOutlineMessage(currentPhase)}
                        />
                      ) : null}
                    </div>
                  </TabsContent>
                  <TabsContent value="characters" className="mt-0">
                    <div className="grid content-start gap-4">
                      {characterStates?.length ? (
                        <DetailSection title="人物状态">
                          <ul className="m-0 pl-5">
                            {characterStates.map((state) => (
                              <li key={state.characterId}>
                                {state.characterName}
                                {state.location ? ` · ${state.location}` : ''}
                                {state.status ? ` · ${state.status}` : ''}
                              </li>
                            ))}
                          </ul>
                        </DetailSection>
                      ) : null}
                      {!characterStates?.length ? (
                        <DetailEmpty message="暂无人物状态" />
                      ) : null}
                    </div>
                  </TabsContent>
                  <TabsContent value="threads" className="mt-0">
                    <div className="grid content-start gap-4">
                      {plotThreads?.length ? (
                        <DetailSection title="伏笔追踪">
                          <ul className="m-0 pl-5">
                            {plotThreads.map((thread) => (
                              <li key={thread.id}>
                                {thread.description}
                                {thread.resolvedAt
                                  ? ` · 已回收（第 ${thread.resolvedAt} 章）`
                                  : ` · 待回收（预计第 ${thread.expectedPayoff ?? '?'} 章）`}
                              </li>
                            ))}
                          </ul>
                        </DetailSection>
                      ) : null}
                      {!plotThreads?.length ? (
                        <DetailEmpty message="暂无伏笔追踪" />
                      ) : null}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          </aside>
        </div>
      </div>
    </section>
  );
}
