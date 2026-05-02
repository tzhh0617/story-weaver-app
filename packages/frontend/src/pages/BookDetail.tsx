import { useEffect, useRef, useState } from 'react';
import type {
  BookExportFormat,
  ExecutionLogRecord,
} from '@story-weaver/shared/contracts';
import ChapterList from '../components/ChapterList';
import {
  layoutCardClassName,
} from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  contextPanelTabTriggerClassName,
  getEmptyChapterMessage,
  getOpeningRetentionLabel,
  getTensionCheckpointInstruction,
  getTensionRebalanceInstructions,
} from './book-detail/types';
import type {
  ContextTab,
  ChapterTensionBudgetView,
  NarrativeCheckpointView,
  ChapterFlatnessIssueView,
  ChapterViralIssueView,
  ViralStoryProtocolView,
  StoryRoutePlanView,
  RenderedChapter,
} from './book-detail/types';
import BookHeader from './book-detail/BookHeader';
import { SceneTabContent, OutlineTabContent, DetailEmpty } from './book-detail/OutlineSection';
import { CharactersTabContent, ThreadsTabContent } from './book-detail/NarrativePanel';
import GenerationProgress from './book-detail/GenerationProgress';

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

export default function BookDetail({
  book,
  context,
  latestScene,
  narrative,
  characterStates,
  plotThreads,
  chapters,
  progress,
  liveOutput,
  executionLogs = [],
  isActive = false,
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
  narrative?: {
    storyBible?: {
      themeQuestion: string;
      themeAnswerDirection: string;
      centralDramaticQuestion: string;
      viralStoryProtocol?: ViralStoryProtocolView | null;
    } | null;
    chapterTensionBudgets?: ChapterTensionBudgetView[];
    narrativeCheckpoints?: NarrativeCheckpointView[];
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
    auditFlatnessScore?: number | null;
    auditFlatnessIssues?: ChapterFlatnessIssueView[];
    auditViralScore?: number | null;
    auditViralIssues?: ChapterViralIssueView[];
    storyRoutePlan?: StoryRoutePlanView | null;
    draftAttempts?: number;
  }>;
  progress?: {
    phase?: string | null;
    stepLabel?: string | null;
    currentVolume?: number | null;
    currentChapter?: number | null;
  } | null;
  isActive?: boolean;
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
  const renderedChapters: RenderedChapter[] =
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
      auditFlatnessScore: chapter.auditFlatnessScore,
      auditFlatnessIssues: chapter.auditFlatnessIssues,
      auditViralScore: chapter.auditViralScore,
      auditViralIssues: chapter.auditViralIssues,
      storyRoutePlan: chapter.storyRoutePlan,
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
  const completedChapters = renderedChapters.filter(
    (chapter) => chapter.status === 'done'
  ).length;
  const totalChapters = renderedChapters.length;
  const hasRemainingChapters =
    renderedChapters.length === 0
      ? currentPhase !== 'completed'
      : renderedChapters.some((chapter) => chapter.status !== 'done');
  const hasGeneratedContent = Boolean(
    chapters?.some((chapter) => chapter.content && chapter.content.trim().length > 0)
  );
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
  const selectedFlatnessScore =
    typeof selectedChapter?.auditFlatnessScore === 'number'
      ? selectedChapter.auditFlatnessScore
      : null;
  const selectedFlatnessIssues = selectedChapter?.auditFlatnessIssues ?? [];
  const selectedViralScore =
    typeof selectedChapter?.auditViralScore === 'number'
      ? selectedChapter.auditViralScore
      : null;
  const selectedViralIssues = selectedChapter?.auditViralIssues ?? [];
  const selectedOpeningRetentionLabel = getOpeningRetentionLabel(
    selectedChapter?.chapterIndex
  );
  const selectedStoryRoutePlan = selectedChapter?.storyRoutePlan ?? null;
  const viralStoryProtocol =
    narrative?.storyBible?.viralStoryProtocol ?? null;
  const selectedTensionBudget =
    selectedChapter && narrative?.chapterTensionBudgets
      ? narrative.chapterTensionBudgets.find(
          (budget) =>
            budget.volumeIndex === selectedChapter.volumeIndex &&
            budget.chapterIndex === selectedChapter.chapterIndex
        ) ?? null
      : null;
  const chapterTensionBudgets = narrative?.chapterTensionBudgets ?? [];
  const narrativeCheckpoints = narrative?.narrativeCheckpoints ?? [];
  const latestNarrativeCheckpoint = narrativeCheckpoints.length > 0
    ? [...narrativeCheckpoints].sort((left, right) => {
        const createdDiff =
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        if (createdDiff) return createdDiff;
        return right.chapterIndex - left.chapterIndex;
      })[0] ?? null
    : null;
  const hasTensionCheckpointContent = latestNarrativeCheckpoint
    ? Boolean(
        getTensionCheckpointInstruction(latestNarrativeCheckpoint) ||
          getTensionRebalanceInstructions(latestNarrativeCheckpoint).length
      )
    : false;
  const hasOutlineTabContent = Boolean(
    hasOutlineContent ||
      selectedOpeningRetentionLabel ||
      selectedStoryRoutePlan ||
      selectedTensionBudget ||
      chapterTensionBudgets.length >= 2 ||
      selectedFlatnessScore !== null ||
      selectedFlatnessIssues.length > 0 ||
      selectedViralScore !== null ||
      selectedViralIssues.length > 0 ||
      viralStoryProtocol ||
      hasTensionCheckpointContent
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

  const outlineChapterData = selectedChapter
    ? {
        chapterIndex: selectedChapter.chapterIndex,
        openingRetentionLabel: selectedOpeningRetentionLabel,
        storyRoutePlan: selectedStoryRoutePlan,
        tensionBudget: selectedTensionBudget,
        flatnessScore: selectedFlatnessScore,
        flatnessIssues: selectedFlatnessIssues,
        viralScore: selectedViralScore,
        viralIssues: selectedViralIssues,
      }
    : null;

  return (
    <section
      data-testid="book-detail-workbench"
      className="grid h-full min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden"
    >
      <BookHeader
        book={book}
        currentPhase={currentPhase}
        isActive={isActive}
        hasRemainingChapters={hasRemainingChapters}
        hasGeneratedContent={hasGeneratedContent}
        onBackToLibrary={onBackToLibrary}
        onPause={onPause}
        onResume={onResume}
        onRestart={onRestart}
        onExport={onExport}
        onDelete={onDelete}
      />

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
            {selectedFlatnessScore !== null ? (
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                {`防平 ${selectedFlatnessScore}`}
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

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-5 overflow-hidden">
          <GenerationProgress logs={executionLogs} />

          <aside
            aria-label="上下文面板"
            className={`${layoutCardClassName} min-h-0 overflow-hidden`}
          >
            <Tabs
              value={contextTab}
              onValueChange={(value) => setContextTab(value as ContextTab)}
              className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]"
            >
              <header
                data-testid="context-panel-tabs-header"
                className="border-b border-border/60 px-3 pt-2"
              >
                <TabsList className="grid h-10 w-full grid-cols-4 justify-start rounded-none bg-transparent p-0 shadow-none">
                  <TabsTrigger
                    value="scene"
                    className={contextPanelTabTriggerClassName}
                    onClick={() => setContextTab('scene')}
                  >
                    场景
                  </TabsTrigger>
                  <TabsTrigger
                    value="outline"
                    className={contextPanelTabTriggerClassName}
                    onClick={() => setContextTab('outline')}
                  >
                    大纲
                  </TabsTrigger>
                  <TabsTrigger
                    value="characters"
                    className={contextPanelTabTriggerClassName}
                    onClick={() => setContextTab('characters')}
                  >
                    人物
                  </TabsTrigger>
                  <TabsTrigger
                    value="threads"
                    className={contextPanelTabTriggerClassName}
                    onClick={() => setContextTab('threads')}
                  >
                    伏笔
                  </TabsTrigger>
                </TabsList>
              </header>
              <ScrollArea aria-label="上下文滚动区" className="h-full min-h-0 px-4 py-4">
                <div className="grid content-start gap-4 pr-2">
                  <TabsContent value="scene" className="mt-0">
                    <SceneTabContent latestScene={latestScene} />
                  </TabsContent>
                  <TabsContent value="outline" className="mt-0">
                    <OutlineTabContent
                      context={context}
                      selectedChapter={outlineChapterData}
                      viralStoryProtocol={viralStoryProtocol}
                      chapterTensionBudgets={chapterTensionBudgets}
                      narrativeCheckpoints={narrativeCheckpoints}
                      currentPhase={currentPhase}
                      hasOutlineTabContent={hasOutlineTabContent}
                    />
                  </TabsContent>
                  <TabsContent value="characters" className="mt-0">
                    <CharactersTabContent characterStates={characterStates} />
                  </TabsContent>
                  <TabsContent value="threads" className="mt-0">
                    <ThreadsTabContent plotThreads={plotThreads} />
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </aside>
        </div>
      </div>
    </section>
  );
}
