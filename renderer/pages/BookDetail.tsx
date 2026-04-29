import { useEffect, useRef, useState } from 'react';
import {
  Download,
  ListChecks,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { BookExportFormat } from '../../src/shared/contracts';
import ChapterList from '../components/ChapterList';
import {
  layoutCardClassName,
  layoutCardSectionClassName,
  pageIntroDescriptionClassName,
  pageIntroEyebrowClassName,
  pageIntroPanelClassName,
  pageIntroTitleClassName,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import ProgressBar from '../components/ProgressBar';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getStatusLabel } from '../status-labels';

type ContextTab = 'outline' | 'characters' | 'threads';

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

function countReadableCharacters(content: string) {
  return Array.from(content.replace(/\s/g, '')).length;
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
      <div className="mb-4 border-b border-border/70 pb-3">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

function GenerationProgressPanel({
  phase,
  stepLabel,
  currentVolume,
  currentChapter,
  completedChapters,
  totalChapters,
}: {
  phase: string;
  stepLabel?: string | null;
  currentVolume?: number | null;
  currentChapter?: number | null;
  completedChapters: number;
  totalChapters: number;
}) {
  const chapterLabel =
    currentVolume && currentChapter
      ? `第 ${currentVolume}.${currentChapter} 章`
      : '暂无当前章节';
  const chapterProgressLabel = totalChapters
    ? `已完成 ${completedChapters} / ${totalChapters} 章`
    : '章节规划生成后会显示总进度';
  const progressPercent = totalChapters
    ? Math.round((completedChapters / totalChapters) * 100)
    : 0;

  return (
    <DetailSection title="当前步骤">
      <div className="grid gap-2">
        <p className="font-medium text-foreground">
          {stepLabel || getStatusLabel(phase)}
        </p>
        <p>{chapterLabel}</p>
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
    </DetailSection>
  );
}

function LiveOutputPanel({
  liveOutput,
  chapterLabel,
}: {
  liveOutput?: {
    volumeIndex: number;
    chapterIndex: number;
    title: string;
    content: string;
  } | null;
  chapterLabel?: string | null;
}) {
  if (!liveOutput?.content) {
    return null;
  }

  const renderedChapterLabel =
    chapterLabel ?? `第 ${liveOutput.volumeIndex}.${liveOutput.chapterIndex} 章`;
  const readableCharacters = countReadableCharacters(liveOutput.content);

  return (
    <DetailSection title="实时输出">
      <div className="grid gap-3">
        <p className="font-medium text-foreground">
          {`正在输出 ${liveOutput.title}`}
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          {`${renderedChapterLabel} · 已接收 ${readableCharacters} 字`}
        </p>
        <p className="whitespace-pre-wrap">{liveOutput.content}</p>
      </div>
    </DetailSection>
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

function SelectedChapterMeta({
  chapter,
}: {
  chapter: {
    volumeIndex?: number;
    chapterIndex?: number;
    displayIndex?: number;
    title: string;
  };
}) {
  const chapterLabel = chapter.displayIndex
    ? `第 ${chapter.displayIndex} 章`
    : '未编号章节';

  return (
    <div className="rounded-lg border border-border/75 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">
        {`当前查看：${chapterLabel} · ${chapter.title}`}
      </p>
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
      className="rounded-[1.15rem] border border-dashed border-border/80 bg-muted/30 p-5 text-sm text-muted-foreground"
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
  onBackToLibrary,
  onPause,
  onResume,
  onRestart,
  onWriteNext,
  onWriteAll,
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
  onBackToLibrary?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onWriteNext?: () => void;
  onWriteAll?: () => void;
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
  const hasOutlineContent = Boolean(context?.worldSetting || context?.outline);
  const currentPhase = progress?.phase ?? book.status;
  const completedChapters = renderedChapters.filter(
    (chapter) => chapter.status === 'done'
  ).length;
  const totalChapters = renderedChapters.length;
  const hasRemainingChapters = Boolean(
    chapters?.some((chapter) => chapter.status !== 'done')
  );
  const hasGeneratedContent = Boolean(
    chapters?.some((chapter) => chapter.content && chapter.content.trim().length > 0)
  );
  const canPause = currentPhase !== 'paused' && currentPhase !== 'completed';
  const canResume = currentPhase === 'paused';
  const canWrite =
    hasRemainingChapters &&
    currentPhase !== 'paused' &&
    currentPhase !== 'completed';
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
  const selectedSummary = selectedChapter?.summary;
  const selectedOutline = selectedChapter?.outline;
  const liveOutputChapterLabel = liveOutput
    ? renderedChapters.find(
        (chapter) =>
          chapter.volumeIndex === liveOutput.volumeIndex &&
          chapter.chapterIndex === liveOutput.chapterIndex
      )?.displayIndex
    : null;
  const canReturnToActiveChapter = Boolean(
    activeChapterId && selectedChapterId !== activeChapterId
  );
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

  return (
    <section
      data-testid="book-detail-workbench"
      className="grid h-full min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 overflow-hidden"
    >
      <header
        data-testid="book-detail-intro-panel"
        className={`${pageIntroPanelClassName} px-5 py-4`}
      >
        <div className="grid gap-2">
          {onBackToLibrary ? (
            <button
              type="button"
              className="w-fit text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
              onClick={onBackToLibrary}
            >
              返回作品库
            </button>
          ) : null}
          <p className={pageIntroEyebrowClassName}>Manuscript Workspace</p>
          <h1 className={`${pageIntroTitleClassName} text-2xl`}>
            {book.title}
          </h1>
          <p className={`${pageIntroDescriptionClassName} mt-1`}>
            {`${getStatusLabel(progress?.phase ?? book.status)} · ${book.wordCount} 字`}
          </p>
        </div>
      </header>

      <div
        data-testid="book-detail-header"
        className={`grid gap-4 px-5 py-4 ${layoutCardClassName}`}
      >
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={onPause} disabled={!canPause}>
            <Pause aria-hidden="true" />
            暂停
          </Button>
          <Button type="button" onClick={onResume} disabled={!canResume}>
            <Play aria-hidden="true" />
            恢复写作
          </Button>
          <Button type="button" variant="outline" onClick={onRestart}>
            <RotateCcw aria-hidden="true" />
            重新开始
          </Button>
          <Button type="button" variant="outline" onClick={onWriteNext} disabled={!canWrite}>
            <PenLine aria-hidden="true" />
            写下一章
          </Button>
          <Button type="button" variant="outline" onClick={onWriteAll} disabled={!canWrite}>
            <ListChecks aria-hidden="true" />
            连续写作
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onExport?.('txt')}
            disabled={!hasGeneratedContent}
          >
            <Download aria-hidden="true" />
            导出 TXT
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onExport?.('md')}
            disabled={!hasGeneratedContent}
          >
            <Download aria-hidden="true" />
            导出 MD
          </Button>
          <Button type="button" variant="destructive" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            删除作品
          </Button>
        </div>
      </div>

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
          <header className="border-b border-border/60 px-5 py-3">
            <div className="grid gap-1">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                正文
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {selectedChapter?.title ?? '选择章节后查看正文'}
              </p>
            </div>
          </header>
          <ScrollArea
            aria-label="正文滚动区"
            data-testid="chapter-reading-pane"
            className="h-full min-h-0 px-4 py-4"
          >
            <div className="grid content-start gap-5 pr-2">
              {canReturnToActiveChapter && activeChapterId ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                  <span>正在后台追踪当前写作章节。</span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      shouldAutoFollowActiveChapterRef.current = true;
                      setSelectedChapterId(activeChapterId);
                    }}
                  >
                    回到实时追踪
                  </Button>
                </div>
              ) : null}
              <LiveOutputPanel
                liveOutput={liveOutput}
                chapterLabel={
                  liveOutputChapterLabel ? `第 ${liveOutputChapterLabel} 章` : null
                }
              />
              {selectedChapter ? (
                <SelectedChapterMeta chapter={selectedChapter} />
              ) : null}
              {selectedContent ? (
                <DetailSection
                  title={selectedHasLiveOutput ? '实时正文预览' : '正文预览'}
                >
                  <p className="whitespace-pre-wrap">{selectedContent}</p>
                </DetailSection>
              ) : null}
              {!selectedContent && selectedOutline ? (
                <DetailSection title="章节大纲">
                  <p className="whitespace-pre-wrap">{selectedOutline}</p>
                </DetailSection>
              ) : null}
              {selectedSummary ? (
                <DetailSection title="章节摘要">
                  <p>{selectedSummary}</p>
                </DetailSection>
              ) : null}
              {!selectedChapter && !liveOutput?.content ? (
                <DetailEmpty message="选择章节后查看正文" />
              ) : null}
            </div>
          </ScrollArea>
        </section>

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
              <GenerationProgressPanel
                phase={currentPhase}
                stepLabel={progress?.stepLabel}
                currentVolume={progress?.currentVolume}
                currentChapter={progress?.currentChapter}
                completedChapters={completedChapters}
                totalChapters={totalChapters}
              />
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
                <TabsList className="grid w-full grid-cols-3 rounded-lg border border-border/75 bg-card p-1 shadow-sm">
                  <TabsTrigger
                    value="outline"
                    onClick={() => setContextTab('outline')}
                  >
                    大纲
                  </TabsTrigger>
                  <TabsTrigger
                    value="characters"
                    onClick={() => setContextTab('characters')}
                  >
                    人物
                  </TabsTrigger>
                  <TabsTrigger
                    value="threads"
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
    </section>
  );
}
