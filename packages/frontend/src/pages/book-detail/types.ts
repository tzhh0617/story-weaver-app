export type ContextTab = 'scene' | 'outline' | 'characters' | 'threads';

export type ChapterTensionBudgetView = {
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

export type NarrativeCheckpointView = {
  bookId: string;
  chapterIndex: number;
  checkpointType?: string;
  report: unknown;
  futureCardRevisions: unknown[];
  createdAt: string;
};

export type ChapterFlatnessIssueView = {
  type: string;
  severity: string;
  evidence: string;
  fixInstruction: string;
};

export type ChapterViralIssueView = {
  type: string;
  severity: string;
  evidence: string;
  fixInstruction: string;
};

export type ViralStoryProtocolView = {
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

export type StoryRoutePlanView = {
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

export type RenderedChapter = {
  id: string;
  title: string;
  volumeIndex?: number;
  chapterIndex?: number;
  displayIndex: number;
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
};

export const flatnessIssueLabels: Record<string, string> = {
  flat_chapter: '章节发平',
  weak_choice_pressure: '弱选择压力',
  missing_consequence: '缺少代价',
  soft_hook: '软钩子',
  repeated_tension_pattern: '张力重复',
};

export const viralIssueLabels: Record<string, string> = {
  weak_reader_promise: '读者承诺弱',
  unclear_desire: '欲望不清',
  missing_payoff: '缺少回报',
  payoff_without_cost: '回报无代价',
  generic_trope: '套路泛化',
  weak_reader_question: '读者问题弱',
  stale_hook_engine: '钩子陈旧',
};

export const openingRetentionLabels: Record<number, string> = {
  1: '异常入场',
  2: '问题变贵',
  3: '不可逆入局',
  4: '首次明确回报',
  5: '长线敌意',
};

export const contextPanelTabTriggerClassName =
  'rounded-none border-b-2 border-transparent bg-transparent px-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none';

export const maxWritingActivityItems = 20;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getTensionCheckpointInstruction(checkpoint: NarrativeCheckpointView) {
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

export function getTensionRebalanceInstructions(checkpoint: NarrativeCheckpointView) {
  return checkpoint.futureCardRevisions
    .filter(isRecord)
    .filter((revision) => revision.type === 'tension_budget_rebalance')
    .map((revision) => revision.instruction)
    .filter(
      (instruction): instruction is string =>
        typeof instruction === 'string' && instruction.trim().length > 0
    );
}

export function getOpeningRetentionLabel(chapterIndex?: number | null) {
  if (typeof chapterIndex !== 'number') {
    return null;
  }

  return openingRetentionLabels[chapterIndex] ?? null;
}

export function getLatestNarrativeCheckpoint(checkpoints: NarrativeCheckpointView[]) {
  return [...checkpoints].sort((left, right) => {
    const createdDiff =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

    if (createdDiff) {
      return createdDiff;
    }

    return right.chapterIndex - left.chapterIndex;
  })[0] ?? null;
}

export function getEmptyChapterMessage(phase: string) {
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

export function getEmptyOutlineMessage(phase: string) {
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
