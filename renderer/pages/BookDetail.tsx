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
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  executionLogLevelLabels,
  getExecutionEventLabel,
  getExecutionPhaseLabel,
  getExecutionLogLevelClassName,
  getExecutionLogLevelIcon,
} from '../execution-log-format';
import { getStatusLabel } from '../status-labels';
import { formatTotalWordCount } from '../word-count-format';

type ContextTab = 'scene' | 'outline' | 'characters' | 'threads';

type ChapterTensionBudgetView = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  pressureLevel: string;
  dominantTension: string;
  requiredTurn: string;
  forcedChoice: string;
  costToPay: string;
  irreversibleChange: string;
  readerQuestion: string;
  hookPressure: string;
  flatnessRisks: string[];
};

type NarrativeCheckpointView = {
  bookId: string;
  chapterIndex: number;
  checkpointType?: string;
  report: unknown;
  futureCardRevisions: unknown[];
  createdAt: string;
};

type ChapterFlatnessIssueView = {
  type: string;
  severity: string;
  evidence: string;
  fixInstruction: string;
};

type ChapterViralIssueView = {
  type: string;
  severity: string;
  evidence: string;
  fixInstruction: string;
};

type ViralStoryProtocolView = {
  readerPromise: string;
  targetEmotion: string;
  coreDesire: string;
  protagonistDrive: string;
  hookEngine: string;
  payoffCadence: {
    mode: string;
    minorPayoffEveryChapters: number;
    majorPayoffEveryChapters: number;
    payoffTypes: string[];
  };
  tropeContract: string[];
  antiClicheRules: string[];
  longTermQuestion: string;
};

type StoryRoutePlanView = {
  taskType: string;
  requiredSkills: Array<{
    id: string;
    name: string;
    type: string;
    rigidity: string;
  }>;
  optionalSkills: Array<{
    id: string;
    name: string;
    type: string;
    rigidity: string;
  }>;
  hardConstraints: string[];
  checklist: string[];
  redFlags: string[];
  warnings: string[];
};

const flatnessIssueLabels: Record<string, string> = {
  flat_chapter: '章节发平',
  weak_choice_pressure: '弱选择压力',
  missing_consequence: '缺少代价',
  soft_hook: '软钩子',
  repeated_tension_pattern: '张力重复',
};

const viralIssueLabels: Record<string, string> = {
  weak_reader_promise: '读者承诺弱',
  unclear_desire: '欲望不清',
  missing_payoff: '缺少回报',
  payoff_without_cost: '回报无代价',
  generic_trope: '套路泛化',
  weak_reader_question: '读者问题弱',
  stale_hook_engine: '钩子陈旧',
};

const openingRetentionLabels: Record<number, string> = {
  1: '异常入场',
  2: '问题变贵',
  3: '不可逆入局',
  4: '首次明确回报',
  5: '长线敌意',
};

const contextPanelTabTriggerClassName =
  'rounded-none border-b-2 border-transparent bg-transparent px-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none';
const maxWritingActivityItems = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getTensionCheckpointInstruction(checkpoint: NarrativeCheckpointView) {
  if (!isRecord(checkpoint.report)) {
    return null;
  }

  const tensionCheckpoint = checkpoint.report.tensionCheckpoint;
  if (!isRecord(tensionCheckpoint)) {
    return null;
  }

  const instruction = tensionCheckpoint.nextBudgetInstruction;
  return typeof instruction === 'string' && instruction.trim().length
    ? instruction
    : null;
}

function getTensionRebalanceInstructions(checkpoint: NarrativeCheckpointView) {
  return checkpoint.futureCardRevisions
    .filter(isRecord)
    .filter((revision) => revision.type === 'tension_budget_rebalance')
    .map((revision) => revision.instruction)
    .filter(
      (instruction): instruction is string =>
        typeof instruction === 'string' && instruction.trim().length > 0
    );
}

function getOpeningRetentionLabel(chapterIndex?: number | null) {
  if (typeof chapterIndex !== 'number') {
    return null;
  }

  return openingRetentionLabels[chapterIndex] ?? null;
}

function getLatestNarrativeCheckpoint(checkpoints: NarrativeCheckpointView[]) {
  return [...checkpoints].sort((left, right) => {
    const createdDiff =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

    if (createdDiff) {
      return createdDiff;
    }

    return right.chapterIndex - left.chapterIndex;
  })[0] ?? null;
}

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

function TensionBudgetSection({
  budget,
}: {
  budget: ChapterTensionBudgetView;
}) {
  return (
    <DetailSection title="张力预算">
      <div className="grid gap-3">
        <p className="text-xs font-semibold text-foreground">
          {`${budget.pressureLevel} · ${budget.dominantTension}`}
        </p>
        <dl className="grid gap-2">
          <div>
            <dt className="text-xs font-semibold text-foreground">强制选择</dt>
            <dd>{budget.forcedChoice}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-foreground">代价</dt>
            <dd>{budget.costToPay}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-foreground">不可逆变化</dt>
            <dd>{budget.irreversibleChange}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-foreground">章末压力</dt>
            <dd>{budget.hookPressure}</dd>
          </div>
        </dl>
      </div>
    </DetailSection>
  );
}

function OpeningRetentionSection({
  chapterIndex,
  budget,
}: {
  chapterIndex: number;
  budget: ChapterTensionBudgetView | null;
}) {
  const label = getOpeningRetentionLabel(chapterIndex);

  if (!label) {
    return null;
  }

  return (
    <DetailSection title="开篇留存">
      <div className="grid gap-3">
        <p className="text-xs font-semibold text-foreground">
          {`第 ${chapterIndex} 章 · ${label}`}
        </p>
        {budget ? (
          <dl className="grid gap-2">
            <div>
              <dt className="text-xs font-semibold text-foreground">读者问题</dt>
              <dd>{budget.readerQuestion}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-foreground">章末压力</dt>
              <dd>{budget.hookPressure}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-foreground">代价</dt>
              <dd>{budget.costToPay}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-foreground">不可逆变化</dt>
              <dd>{budget.irreversibleChange}</dd>
            </div>
          </dl>
        ) : (
          <p>等待张力预算生成后显示读者问题、代价和章末压力。</p>
        )}
      </div>
    </DetailSection>
  );
}

function StoryRouteSection({ plan }: { plan: StoryRoutePlanView }) {
  const visibleSkills = [...plan.requiredSkills, ...plan.optionalSkills].slice(0, 6);

  return (
    <DetailSection title="写作路由">
      <div className="grid gap-3">
        <p className="text-xs font-semibold text-foreground">{plan.taskType}</p>
        <div className="flex flex-wrap gap-2">
          {visibleSkills.map((skill) => (
            <Badge key={skill.id} variant="secondary">
              {skill.name}
            </Badge>
          ))}
        </div>
        {plan.checklist.length ? (
          <ul className="m-0 grid gap-1 pl-5">
            {plan.checklist.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {plan.warnings.length ? (
          <p className="text-xs text-muted-foreground">
            {`提示：${plan.warnings[0]}`}
          </p>
        ) : null}
      </div>
    </DetailSection>
  );
}

function ViralProtocolSection({
  protocol,
}: {
  protocol: ViralStoryProtocolView;
}) {
  return (
    <DetailSection title="爆款策略">
      <div className="grid gap-3">
        <dl className="grid gap-2">
          <div>
            <dt className="text-xs font-semibold text-foreground">读者承诺</dt>
            <dd>{protocol.readerPromise}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-foreground">核心欲望</dt>
            <dd>{protocol.coreDesire}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-foreground">钩子引擎</dt>
            <dd>{protocol.hookEngine}</dd>
          </div>
        </dl>
        <div className="grid gap-1">
          <p className="text-xs font-semibold text-foreground">
            {`${protocol.payoffCadence.mode} · 每 ${protocol.payoffCadence.minorPayoffEveryChapters} 章小回报`}
          </p>
          <p>
            {`每 ${protocol.payoffCadence.majorPayoffEveryChapters} 章大回报`}
          </p>
          {protocol.payoffCadence.payoffTypes.length ? (
            <p>{protocol.payoffCadence.payoffTypes.join(' / ')}</p>
          ) : null}
        </div>
        {protocol.antiClicheRules.length ? (
          <ul className="m-0 grid gap-1 pl-4">
            {protocol.antiClicheRules.slice(0, 3).map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </DetailSection>
  );
}

function TensionCurveSection({
  budgets,
}: {
  budgets: ChapterTensionBudgetView[];
}) {
  if (budgets.length < 2) {
    return null;
  }

  const sortedBudgets = [...budgets].sort(
    (left, right) =>
      left.volumeIndex - right.volumeIndex ||
      left.chapterIndex - right.chapterIndex
  );

  return (
    <DetailSection title="张力曲线">
      <ol
        aria-label="张力曲线"
        className="m-0 grid list-none gap-2 p-0"
      >
        {sortedBudgets.map((budget) => (
          <li
            key={`${budget.volumeIndex}-${budget.chapterIndex}`}
            className="grid gap-1 border-l-2 border-border/70 pl-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-xs font-semibold text-foreground">
                {`第 ${budget.chapterIndex} 章`}
              </span>
              <span className="min-w-0 text-xs font-medium text-muted-foreground">
                {`${budget.pressureLevel} · ${budget.dominantTension}`}
              </span>
            </div>
            <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
              {budget.requiredTurn}
            </p>
          </li>
        ))}
      </ol>
    </DetailSection>
  );
}

function TensionCheckpointSection({
  checkpoint,
}: {
  checkpoint: NarrativeCheckpointView;
}) {
  const nextBudgetInstruction = getTensionCheckpointInstruction(checkpoint);
  const rebalanceInstructions = getTensionRebalanceInstructions(checkpoint);

  if (!nextBudgetInstruction && !rebalanceInstructions.length) {
    return null;
  }

  return (
    <DetailSection title="张力复盘">
      <div className="grid gap-3">
        <p className="text-xs font-semibold text-foreground">
          {`第 ${checkpoint.chapterIndex} 章后${checkpoint.checkpointType ? ` · ${checkpoint.checkpointType}` : ''}`}
        </p>
        {nextBudgetInstruction ? (
          <div>
            <p className="text-xs font-semibold text-foreground">下章预算指令</p>
            <p>{nextBudgetInstruction}</p>
          </div>
        ) : null}
        {rebalanceInstructions.length ? (
          <div>
            <p className="text-xs font-semibold text-foreground">重平衡建议</p>
            <ul className="m-0 grid gap-1 pl-4">
              {rebalanceInstructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </DetailSection>
  );
}

function FlatnessAuditSection({
  score,
  issues,
}: {
  score: number | null;
  issues: ChapterFlatnessIssueView[];
}) {
  if (score === null && !issues.length) {
    return null;
  }

  return (
    <DetailSection title="防平审计">
      <div className="grid gap-3">
        {score !== null ? (
          <p className="text-xs font-semibold text-foreground">
            {`防平分 ${score}`}
          </p>
        ) : null}
        {issues.length ? (
          <ul className="m-0 grid gap-3 p-0">
            {issues.map((issue) => (
              <li
                key={`${issue.type}-${issue.fixInstruction}`}
                className="grid gap-1 border-l-2 border-border/70 pl-3"
              >
                <p className="text-xs font-semibold text-foreground">
                  {`${flatnessIssueLabels[issue.type] ?? issue.type} · ${issue.severity}`}
                </p>
                <p>{issue.evidence}</p>
                <p>{issue.fixInstruction}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </DetailSection>
  );
}

function ViralAuditSection({
  score,
  issues,
}: {
  score: number | null;
  issues: ChapterViralIssueView[];
}) {
  if (score === null && !issues.length) {
    return null;
  }

  return (
    <DetailSection title="爆款审计">
      <div className="grid gap-3">
        {score !== null ? (
          <p className="text-xs font-semibold text-foreground">
            {`爆款分 ${score}`}
          </p>
        ) : null}
        {issues.length ? (
          <ul className="m-0 grid gap-3 p-0">
            {issues.map((issue) => (
              <li
                key={`${issue.type}-${issue.fixInstruction}`}
                className="grid gap-1 border-l-2 border-border/70 pl-3"
              >
                <p className="text-xs font-semibold text-foreground">
                  {`${viralIssueLabels[issue.type] ?? issue.type} · ${issue.severity}`}
                </p>
                <p>{issue.evidence}</p>
                <p>{issue.fixInstruction}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </DetailSection>
  );
}

function WritingActivityPanel({ logs }: { logs: ExecutionLogRecord[] }) {
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
  bookListSummary,
  context,
  latestScene,
  narrative,
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
  bookListSummary?: {
    completedChapters?: number;
    totalChapters?: number;
  } | null;
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
  const totalWordCountText = formatTotalWordCount(book.wordCount);
  const renderedCompletedChapters = renderedChapters.filter(
    (chapter) => chapter.status === 'done'
  ).length;
  const renderedTotalChapters = renderedChapters.length;
  const completedChapters =
    renderedTotalChapters > 0
      ? renderedCompletedChapters
      : bookListSummary?.completedChapters ?? 0;
  const totalChapters =
    renderedTotalChapters > 0
      ? renderedTotalChapters
      : bookListSummary?.totalChapters ?? 0;
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
  const latestNarrativeCheckpoint = getLatestNarrativeCheckpoint(
    narrative?.narrativeCheckpoints ?? []
  );
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
          <WritingActivityPanel logs={executionLogs} />

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
                    <div className="grid content-start gap-4">
                      {latestScene ? (
                        <DetailSection title="最近场景">
                          <p>{`${latestScene.location} · ${latestScene.timeInStory}`}</p>
                          {latestScene.events ? <p>{latestScene.events}</p> : null}
                        </DetailSection>
                      ) : (
                        <DetailEmpty message="暂无场景记录" />
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="outline" className="mt-0">
                    <div className="grid content-start gap-4">
                      {selectedChapter?.chapterIndex &&
                      selectedOpeningRetentionLabel ? (
                        <OpeningRetentionSection
                          chapterIndex={selectedChapter.chapterIndex}
                          budget={selectedTensionBudget}
                        />
                      ) : null}
                      {viralStoryProtocol ? (
                        <ViralProtocolSection protocol={viralStoryProtocol} />
                      ) : null}
                      {selectedStoryRoutePlan ? (
                        <StoryRouteSection plan={selectedStoryRoutePlan} />
                      ) : null}
                      {selectedTensionBudget ? (
                        <TensionBudgetSection budget={selectedTensionBudget} />
                      ) : null}
                      <ViralAuditSection
                        score={selectedViralScore}
                        issues={selectedViralIssues}
                      />
                      <FlatnessAuditSection
                        score={selectedFlatnessScore}
                        issues={selectedFlatnessIssues}
                      />
                      <TensionCurveSection budgets={chapterTensionBudgets} />
                      {latestNarrativeCheckpoint ? (
                        <TensionCheckpointSection
                          checkpoint={latestNarrativeCheckpoint}
                        />
                      ) : null}
                      {context?.worldSetting ? (
                        <DetailSection title="世界观">
                          <p className="whitespace-pre-wrap">
                            {context.worldSetting}
                          </p>
                        </DetailSection>
                      ) : null}
                      {context?.outline ? (
                        <DetailSection title="总纲">
                          <p className="whitespace-pre-wrap">
                            {context.outline}
                          </p>
                        </DetailSection>
                      ) : null}
                      {!hasOutlineTabContent ? (
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
                          <ul className="m-0 grid list-none gap-1 p-0">
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
                          <ul className="m-0 grid list-none gap-1 p-0">
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
                </div>
              </ScrollArea>
            </Tabs>
          </aside>
        </div>
      </div>
    </section>
  );
}
