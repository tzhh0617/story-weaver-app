import { useEffect, useState } from 'react';
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
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getStatusLabel } from '../status-labels';

type DetailTab = 'chapters' | 'outline' | 'characters' | 'threads';

function getEmptyChapterMessage(phase: string) {
  if (phase === 'naming_title') {
    return '正在生成书名...';
  }

  if (phase === 'creating') {
    return '正在创建书本...';
  }

  if (phase === 'building_world') {
    return '正在生成世界观...';
  }

  if (phase === 'building_outline' || phase === 'planning_chapters') {
    return '正在规划章节...';
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
}: {
  phase: string;
  stepLabel?: string | null;
  currentVolume?: number | null;
  currentChapter?: number | null;
}) {
  const chapterLabel =
    currentVolume && currentChapter
      ? `第 ${currentVolume}.${currentChapter} 章`
      : '暂无当前章节';

  return (
    <DetailSection title="当前步骤">
      <div className="grid gap-2">
        <p className="font-medium text-foreground">
          {stepLabel || getStatusLabel(phase)}
        </p>
        <p>{chapterLabel}</p>
      </div>
    </DetailSection>
  );
}

function LiveOutputPanel({
  liveOutput,
}: {
  liveOutput?: {
    volumeIndex: number;
    chapterIndex: number;
    title: string;
    content: string;
  } | null;
}) {
  if (!liveOutput?.content) {
    return null;
  }

  return (
    <DetailSection title="实时输出">
      <div className="grid gap-3">
        <p className="font-medium text-foreground">
          {`正在输出 ${liveOutput.title}`}
        </p>
        <p className="whitespace-pre-wrap">{liveOutput.content}</p>
      </div>
    </DetailSection>
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
    chapters?.map((chapter) => ({
      id:
        chapter.id ??
        `${chapter.volumeIndex ?? 0}-${chapter.chapterIndex ?? 0}`,
      title: chapter.title,
      volumeIndex: chapter.volumeIndex,
      chapterIndex: chapter.chapterIndex,
      wordCount: chapter.wordCount,
      status: chapter.status,
      content: chapter.content,
      summary: chapter.summary,
      outline: chapter.outline,
    })) ?? [];
  const [activeTab, setActiveTab] = useState<DetailTab>('chapters');
  const activeChapterId =
    progress?.currentVolume && progress?.currentChapter
      ? `${progress.currentVolume}-${progress.currentChapter}`
      : liveOutput
        ? `${liveOutput.volumeIndex}-${liveOutput.chapterIndex}`
        : null;
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    activeChapterId ?? renderedChapters[0]?.id ?? null
  );
  const hasOutlineContent = Boolean(context?.worldSetting || context?.outline);
  const currentPhase = progress?.phase ?? book.status;
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

  useEffect(() => {
    if (activeChapterId) {
      setSelectedChapterId((current) => current ?? activeChapterId);
      return;
    }

    setSelectedChapterId((current) => current ?? renderedChapters[0]?.id ?? null);
  }, [activeChapterId, renderedChapters]);

  return (
    <section className="grid gap-6">
      <header
        data-testid="book-detail-intro-panel"
        className={pageIntroPanelClassName}
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
          <h1 className={pageIntroTitleClassName}>{book.title}</h1>
          <p className={pageIntroDescriptionClassName}>
            {`${getStatusLabel(progress?.phase ?? book.status)} · ${book.wordCount} 字`}
          </p>
        </div>
      </header>

      <div
        data-testid="book-detail-header"
        className={`grid gap-5 px-5 py-5 ${layoutCardClassName}`}
      >
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={onPause} disabled={!canPause}>
            暂停
          </Button>
          <Button type="button" onClick={onResume} disabled={!canResume}>
            恢复写作
          </Button>
          <Button type="button" variant="outline" onClick={onRestart}>
            重新开始
          </Button>
          <Button type="button" variant="outline" onClick={onWriteNext} disabled={!canWrite}>
            写下一章
          </Button>
          <Button type="button" variant="outline" onClick={onWriteAll} disabled={!canWrite}>
            连续写作
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onExport?.('txt')}
            disabled={!hasGeneratedContent}
          >
            导出 TXT
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onExport?.('md')}
            disabled={!hasGeneratedContent}
          >
            导出 MD
          </Button>
          <Button type="button" variant="destructive" onClick={onDelete}>
            删除作品
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_22rem]">
        <div className="grid gap-4">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as DetailTab)}
          >
            <TabsList className="grid w-full grid-cols-4 rounded-lg border border-border/75 bg-card p-1 shadow-sm">
              <TabsTrigger value="chapters" onClick={() => setActiveTab('chapters')}>
                章节
              </TabsTrigger>
              <TabsTrigger value="outline" onClick={() => setActiveTab('outline')}>
                大纲
              </TabsTrigger>
              <TabsTrigger
                value="characters"
                onClick={() => setActiveTab('characters')}
              >
                人物
              </TabsTrigger>
              <TabsTrigger value="threads" onClick={() => setActiveTab('threads')}>
                伏笔
              </TabsTrigger>
            </TabsList>
            <TabsContent value="chapters" className="grid gap-6">
              <ScrollArea aria-label="章节滚动区">
                <div className="grid gap-5 pt-2">
                  {renderedChapters.length ? (
                    <ChapterList
                      chapters={renderedChapters}
                      activeChapterId={activeChapterId}
                      selectedChapterId={selectedChapterId}
                      onSelectChapter={setSelectedChapterId}
                    />
                  ) : null}
                  {!renderedChapters.length ? (
                    <DetailEmpty message={getEmptyChapterMessage(currentPhase)} />
                  ) : null}
                  <LiveOutputPanel liveOutput={liveOutput} />
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
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="outline" className="grid gap-6">
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
            </TabsContent>
            <TabsContent value="characters" className="grid gap-6">
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
            </TabsContent>
            <TabsContent value="threads" className="grid gap-6">
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
            </TabsContent>
          </Tabs>
        </div>
        <aside className="grid content-start gap-4">
          <GenerationProgressPanel
            phase={currentPhase}
            stepLabel={progress?.stepLabel}
            currentVolume={progress?.currentVolume}
            currentChapter={progress?.currentChapter}
          />
          {latestScene ? (
            <DetailSection title="最近场景">
              <p>{`${latestScene.location} · ${latestScene.timeInStory}`}</p>
              {latestScene.events ? <p>{latestScene.events}</p> : null}
            </DetailSection>
          ) : (
            <DetailEmpty message="暂无场景记录" />
          )}
          <DetailSection title="写作上下文">
            <p>{context?.outline ?? '大纲生成后会在这里显示主线摘要。'}</p>
          </DetailSection>
        </aside>
      </div>
    </section>
  );
}
