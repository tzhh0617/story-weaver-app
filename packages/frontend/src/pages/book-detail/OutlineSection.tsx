import { Badge } from '../../components/ui/badge';
import {
  layoutCardSectionClassName,
} from '../../components/ui/card';
import {
  getEmptyOutlineMessage,
  getOpeningRetentionLabel,
  getTensionCheckpointInstruction,
  getTensionRebalanceInstructions,
  getLatestNarrativeCheckpoint,
  flatnessIssueLabels,
  viralIssueLabels,
} from './types';
import type {
  ChapterTensionBudgetView,
  NarrativeCheckpointView,
  ChapterFlatnessIssueView,
  ChapterViralIssueView,
  ViralStoryProtocolView,
  StoryRoutePlanView,
} from './types';

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

export function DetailEmpty({
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

export type OutlineSectionProps = {
  latestScene?: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events: string | null;
  } | null;
  context?: {
    worldSetting?: string | null;
    outline?: string | null;
  } | null;
  selectedChapter?: {
    chapterIndex?: number;
    openingRetentionLabel: string | null;
    storyRoutePlan: StoryRoutePlanView | null;
    tensionBudget: ChapterTensionBudgetView | null;
    flatnessScore: number | null;
    flatnessIssues: ChapterFlatnessIssueView[];
    viralScore: number | null;
    viralIssues: ChapterViralIssueView[];
  } | null;
  viralStoryProtocol: ViralStoryProtocolView | null;
  chapterTensionBudgets: ChapterTensionBudgetView[];
  narrativeCheckpoints: NarrativeCheckpointView[];
  currentPhase: string;
  hasOutlineTabContent: boolean;
};

export function SceneTabContent({
  latestScene,
}: {
  latestScene?: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events: string | null;
  } | null;
}) {
  return (
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
  );
}

export function OutlineTabContent({
  context,
  selectedChapter,
  viralStoryProtocol,
  chapterTensionBudgets,
  narrativeCheckpoints,
  currentPhase,
  hasOutlineTabContent,
}: OutlineSectionProps) {
  const latestNarrativeCheckpoint = getLatestNarrativeCheckpoint(
    narrativeCheckpoints
  );

  return (
    <div className="grid content-start gap-4">
      {selectedChapter?.chapterIndex &&
      selectedChapter.openingRetentionLabel ? (
        <OpeningRetentionSection
          chapterIndex={selectedChapter.chapterIndex}
          budget={selectedChapter.tensionBudget}
        />
      ) : null}
      {viralStoryProtocol ? (
        <ViralProtocolSection protocol={viralStoryProtocol} />
      ) : null}
      {selectedChapter?.storyRoutePlan ? (
        <StoryRouteSection plan={selectedChapter.storyRoutePlan} />
      ) : null}
      {selectedChapter?.tensionBudget ? (
        <TensionBudgetSection budget={selectedChapter.tensionBudget} />
      ) : null}
      <ViralAuditSection
        score={selectedChapter?.viralScore ?? null}
        issues={selectedChapter?.viralIssues ?? []}
      />
      <FlatnessAuditSection
        score={selectedChapter?.flatnessScore ?? null}
        issues={selectedChapter?.flatnessIssues ?? []}
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
  );
}
