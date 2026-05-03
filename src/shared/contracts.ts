import type {
  BookContract,
  LatestStoryCheckpoint,
  StoryLedger,
  StoryRunState,
  ViralStoryProtocol,
} from '../core/narrative/types.js';

export type BookStatus =
  | 'creating'
  | 'building_world'
  | 'building_outline'
  | 'writing'
  | 'paused'
  | 'completed'
  | 'error';

export type ViralTropeContractPayload =
  | 'rebirth_change_fate'
  | 'system_growth'
  | 'hidden_identity'
  | 'revenge_payback'
  | 'weak_to_strong'
  | 'forbidden_bond'
  | 'case_breaking'
  | 'sect_or_family_pressure'
  | 'survival_game'
  | 'business_or_power_game';

export type ViralStrategyPayload = {
  readerPayoff?: string;
  protagonistDesire?: string;
  tropeContracts?: ViralTropeContractPayload[];
  cadenceMode?: 'fast' | 'steady' | 'slow_burn' | 'suppressed_then_burst';
  antiClicheDirection?: string;
};

export type BookRecord = {
  id: string;
  title: string;
  idea: string;
  status: BookStatus;
  targetChapters: number;
  wordsPerChapter: number;
  viralStrategy?: ViralStrategyPayload | null;
  createdAt: string;
  updatedAt: string;
};

export type BookListItem = BookRecord & {
  progress: number;
  completedChapters: number;
  totalChapters: number;
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

export type PlanningTaskType =
  | 'book:plan:title-idea'
  | 'book:plan:endgame'
  | 'book:plan:stage'
  | 'book:plan:arc'
  | 'book:plan:chapters'
  | 'book:plan:rebuild-chapters'
  | 'book:state:snapshot';

export type PlanStatus = 'planned' | 'in_progress' | 'completed' | 'needs_revision';

export type BookDetail = {
  book: BookRecord;
  context: {
    bookId?: string;
    worldSetting?: string | null;
    outline?: string | null;
    styleGuide?: string | null;
  } | null;
  narrative?: {
    storyBible: {
      themeQuestion: string;
      themeAnswerDirection: string;
      centralDramaticQuestion: string;
      viralStoryProtocol?: ViralStoryProtocol | null;
    } | null;
    bookContract?: BookContract | null;
    latestLedger?: StoryLedger | null;
    latestCheckpoint?: LatestStoryCheckpoint | null;
    runState?: StoryRunState | null;
    titleIdeaContract?: {
      bookId: string;
      title: string;
      idea: string;
      corePromise: string;
      titleHooks: string[];
      forbiddenDrift: string[];
      createdAt: string;
      updatedAt: string;
    } | null;
    endgamePlan?: {
      bookId: string;
      titleIdeaContract: string;
      protagonistEndState: string;
      finalConflict: string;
      finalOpponent: string;
      worldEndState: string;
      coreCharacterOutcomes: unknown;
      majorPayoffs: unknown;
      createdAt: string;
      updatedAt: string;
    } | null;
    stagePlans?: Array<{
      stageIndex: number;
      chapterStart: number;
      chapterEnd: number;
      chapterBudget: number;
      objective: string;
      primaryResistance: string;
      pressureCurve: string;
      escalation: string;
      climax: string;
      payoff: string;
      irreversibleChange: string;
      nextQuestion: string;
      titleIdeaFocus: string;
      compressionTrigger: string;
      status: PlanStatus | string;
    }>;
    arcPlans?: Array<{
      arcIndex: number;
      stageIndex: number;
      chapterStart: number;
      chapterEnd: number;
      chapterBudget: number;
      primaryThreads: unknown;
      characterTurns: unknown;
      threadActions: unknown;
      targetOutcome: string;
      escalationMode: string;
      turningPoint: string;
      requiredPayoff: string;
      resultingInstability: string;
      titleIdeaFocus: string;
      minChapterCount: number;
      maxChapterCount: number;
      status: PlanStatus | string;
    }>;
    chapterPlans?: Array<{
      batchIndex: number;
      chapterIndex: number;
      arcIndex: number;
      goal: string;
      conflict: string;
      pressureSource: string;
      changeType: string;
      threadActions: unknown;
      reveal: string;
      payoffOrCost: string;
      endingHook: string;
      titleIdeaLink: string;
      batchGoal: string;
      requiredPayoffs: unknown;
      forbiddenDrift: unknown;
      status: PlanStatus | string;
    }>;
    latestStoryStateSnapshot?: {
      bookId: string;
      chapterIndex: number;
      summary: string;
      titleIdeaAlignment: string;
      flatnessRisk: string;
      characterChanges: unknown;
      relationshipChanges: unknown;
      worldFacts: unknown;
      threadUpdates: unknown;
      unresolvedPromises: unknown;
      stageProgress: string;
      remainingChapterBudget: number;
      createdAt: string;
    } | null;
    chapterCards: Array<{
      volumeIndex: number;
      chapterIndex: number;
      mustChange: string;
      readerReward: string;
      endingHook: string;
    }>;
    chapterTensionBudgets: Array<{
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
    }>;
    narrativeCheckpoints: Array<{
      bookId: string;
      chapterIndex: number;
      checkpointType?: string;
      report: unknown;
      futureCardRevisions: unknown[];
      createdAt: string;
    }>;
  };
  latestScene: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events: string | null;
  } | null;
  characterStates: Array<{
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
  plotThreads: Array<{
    id: string;
    description: string;
    plantedAt: number;
    expectedPayoff: number | null;
    resolvedAt: number | null;
    importance: string;
  }>;
  chapters: Array<{
    bookId: string;
    volumeIndex: number;
    chapterIndex: number;
    title: string | null;
    outline: string | null;
    content: string | null;
    summary: string | null;
    wordCount: number;
    auditScore?: number | null;
    auditFlatnessScore?: number | null;
    auditFlatnessIssues?: Array<{
      type: string;
      severity: string;
      evidence: string;
      fixInstruction: string;
    }>;
    auditViralScore?: number | null;
    auditViralIssues?: Array<{
      type: string;
      severity: string;
      evidence: string;
      fixInstruction: string;
    }>;
    storyRoutePlan?: StoryRoutePlanView | null;
    draftAttempts?: number;
  }>;
  progress: {
    phase?: string | null;
    stepLabel?: string | null;
    currentVolume?: number | null;
    currentChapter?: number | null;
    currentStage?: number | null;
    currentArc?: number | null;
    activeTaskType?: PlanningTaskType | string | null;
  } | null;
};

export type SchedulerStatus = {
  runningBookIds: string[];
  queuedBookIds: string[];
  queuedTasks?: Array<{
    taskKey: string;
    bookId: string;
    taskType: PlanningTaskType | string;
    score: number;
  }>;
  pausedBookIds: string[];
  concurrencyLimit: number | null;
};

export type BookGenerationEvent =
  | {
      bookId: string;
      type: 'progress';
      phase: string;
      stepLabel: string;
      currentVolume?: number | null;
      currentChapter?: number | null;
    }
  | {
      bookId: string;
      type: 'chapter-stream';
      volumeIndex: number;
      chapterIndex: number;
      title: string;
      delta: string;
      replace?: boolean;
    }
  | {
      bookId: string;
      type: 'chapter-complete';
      volumeIndex: number;
      chapterIndex: number;
      title: string;
    }
  | {
      bookId: string;
      type: 'error';
      phase: string;
      stepLabel: string;
      error: string;
      currentVolume?: number | null;
      currentChapter?: number | null;
    };

export type ExecutionLogLevel = 'debug' | 'info' | 'success' | 'error';

export type ExecutionLogDebugContext = Record<string, unknown>;

export type ExecutionLogRecord = {
  id: number;
  sequence?: number;
  runId?: string;
  bookId: string | null;
  bookTitle: string | null;
  level: ExecutionLogLevel;
  eventType: string;
  phase: string | null;
  message: string;
  volumeIndex: number | null;
  chapterIndex: number | null;
  errorMessage: string | null;
  errorStack?: string | null;
  durationMs?: number | null;
  debugContext?: ExecutionLogDebugContext | null;
  createdAt: string;
};

export type BookExportFormat = 'txt' | 'md';

export const LOG_MAX_FILE_SIZE_BYTES_KEY = 'logs.maxFileSizeBytes';
export const LOG_RETENTION_DAYS_KEY = 'logs.retentionDays';

export const ipcChannels = {
  bookCreate: 'book:create',
  bookDelete: 'book:delete',
  bookList: 'book:list',
  bookDetail: 'book:detail',
  bookStart: 'book:start',
  bookPause: 'book:pause',
  bookWriteNext: 'book:writeNext',
  bookWriteAll: 'book:writeAll',
  bookResume: 'book:resume',
  bookRestart: 'book:restart',
  bookExport: 'book:export',
  schedulerStartAll: 'scheduler:startAll',
  schedulerPauseAll: 'scheduler:pauseAll',
  schedulerStatus: 'scheduler:status',
  schedulerProgress: 'scheduler:progress',
  bookGeneration: 'book:generation',
  bookChapterDone: 'book:chapterDone',
  bookError: 'book:error',
  modelList: 'model:list',
  modelSave: 'model:save',
  modelTest: 'model:test',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  executionLog: 'logs:event',
} as const;

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels];

export const ipcInvokeChannels = [
  ipcChannels.bookCreate,
  ipcChannels.bookDelete,
  ipcChannels.bookList,
  ipcChannels.bookDetail,
  ipcChannels.bookStart,
  ipcChannels.bookPause,
  ipcChannels.bookWriteNext,
  ipcChannels.bookWriteAll,
  ipcChannels.bookResume,
  ipcChannels.bookRestart,
  ipcChannels.bookExport,
  ipcChannels.schedulerStartAll,
  ipcChannels.schedulerPauseAll,
  ipcChannels.schedulerStatus,
  ipcChannels.modelList,
  ipcChannels.modelSave,
  ipcChannels.modelTest,
  ipcChannels.settingsGet,
  ipcChannels.settingsSet,
] as const;

export type IpcInvokeChannel = (typeof ipcInvokeChannels)[number];

export type BookCreatePayload = {
  idea: string;
  targetChapters: number;
  wordsPerChapter: number;
  viralStrategy?: ViralStrategyPayload;
};

export type BookIdPayload = {
  bookId: string;
};

export type BookExportPayload = BookIdPayload & {
  format: BookExportFormat;
};

export type ModelSavePayload = {
  id: string;
  provider: 'openai' | 'anthropic';
  modelName: string;
  apiKey: string;
  baseUrl: string;
  config: Record<string, unknown>;
};

export type ModelTestPayload = {
  modelId: string;
};

export type SettingsSetPayload = {
  key: string;
  value: string;
};

export type IpcPayloadMap = {
  [ipcChannels.bookCreate]: BookCreatePayload;
  [ipcChannels.bookDelete]: BookIdPayload;
  [ipcChannels.bookList]: undefined;
  [ipcChannels.bookDetail]: BookIdPayload;
  [ipcChannels.bookStart]: BookIdPayload;
  [ipcChannels.bookPause]: BookIdPayload;
  [ipcChannels.bookWriteNext]: BookIdPayload;
  [ipcChannels.bookWriteAll]: BookIdPayload;
  [ipcChannels.bookResume]: BookIdPayload;
  [ipcChannels.bookRestart]: BookIdPayload;
  [ipcChannels.bookExport]: BookExportPayload;
  [ipcChannels.schedulerStartAll]: undefined;
  [ipcChannels.schedulerPauseAll]: undefined;
  [ipcChannels.schedulerStatus]: undefined;
  [ipcChannels.schedulerProgress]: SchedulerStatus;
  [ipcChannels.bookGeneration]: BookGenerationEvent;
  [ipcChannels.bookChapterDone]: undefined;
  [ipcChannels.bookError]: undefined;
  [ipcChannels.modelList]: undefined;
  [ipcChannels.modelSave]: ModelSavePayload;
  [ipcChannels.modelTest]: ModelTestPayload;
  [ipcChannels.settingsGet]: string | undefined;
  [ipcChannels.settingsSet]: SettingsSetPayload;
  [ipcChannels.executionLog]: ExecutionLogRecord;
};

export type IpcResponseMap = {
  [ipcChannels.bookCreate]: string;
  [ipcChannels.bookDelete]: void;
  [ipcChannels.bookList]: BookListItem[];
  [ipcChannels.bookDetail]: BookDetail | null;
  [ipcChannels.bookStart]: void;
  [ipcChannels.bookPause]: void;
  [ipcChannels.bookWriteNext]: unknown;
  [ipcChannels.bookWriteAll]: {
    completedChapters: number;
    status: 'completed' | 'paused' | 'deleted';
  };
  [ipcChannels.bookResume]: void;
  [ipcChannels.bookRestart]: void;
  [ipcChannels.bookExport]: string;
  [ipcChannels.schedulerStartAll]: void;
  [ipcChannels.schedulerPauseAll]: void;
  [ipcChannels.schedulerStatus]: SchedulerStatus;
  [ipcChannels.schedulerProgress]: void;
  [ipcChannels.bookGeneration]: void;
  [ipcChannels.bookChapterDone]: void;
  [ipcChannels.bookError]: void;
  [ipcChannels.modelList]: ModelSavePayload[];
  [ipcChannels.modelSave]: void;
  [ipcChannels.modelTest]: {
    ok: boolean;
    latency: number;
    error: string | null;
  };
  [ipcChannels.settingsGet]: string | null | Array<{ key: string; value: string }>;
  [ipcChannels.settingsSet]: true;
  [ipcChannels.executionLog]: void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isViralTropeContract(value: unknown): value is ViralTropeContractPayload {
  return (
    value === 'rebirth_change_fate' ||
    value === 'system_growth' ||
    value === 'hidden_identity' ||
    value === 'revenge_payback' ||
    value === 'weak_to_strong' ||
    value === 'forbidden_bond' ||
    value === 'case_breaking' ||
    value === 'sect_or_family_pressure' ||
    value === 'survival_game' ||
    value === 'business_or_power_game'
  );
}

function isViralTropeContractArray(
  value: unknown
): value is ViralTropeContractPayload[] {
  return Array.isArray(value) && value.every(isViralTropeContract);
}

function hasBookId(payload: unknown): payload is BookIdPayload {
  return isRecord(payload) && isNonEmptyString(payload.bookId);
}

function isViralStrategyPayload(value: unknown): value is ViralStrategyPayload {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  const cadence = value.cadenceMode;
  return (
    (value.readerPayoff === undefined || typeof value.readerPayoff === 'string') &&
    (value.protagonistDesire === undefined || typeof value.protagonistDesire === 'string') &&
    (value.tropeContracts === undefined || isViralTropeContractArray(value.tropeContracts)) &&
    (cadence === undefined ||
      cadence === 'fast' ||
      cadence === 'steady' ||
      cadence === 'slow_burn' ||
      cadence === 'suppressed_then_burst') &&
    (value.antiClicheDirection === undefined ||
      typeof value.antiClicheDirection === 'string')
  );
}

function isBookCreatePayload(payload: unknown): payload is BookCreatePayload {
  return (
    isRecord(payload) &&
    typeof payload.idea === 'string' &&
    isPositiveInteger(payload.targetChapters) &&
    isPositiveInteger(payload.wordsPerChapter) &&
    isViralStrategyPayload(payload.viralStrategy)
  );
}

function isBookExportPayload(payload: unknown): payload is BookExportPayload {
  if (!hasBookId(payload)) {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return record.format === 'txt' || record.format === 'md';
}

function isModelSavePayload(payload: unknown): payload is ModelSavePayload {
  return (
    isRecord(payload) &&
    isNonEmptyString(payload.id) &&
    (payload.provider === 'openai' || payload.provider === 'anthropic') &&
    isNonEmptyString(payload.modelName) &&
    typeof payload.apiKey === 'string' &&
    typeof payload.baseUrl === 'string' &&
    isRecord(payload.config)
  );
}

function isModelTestPayload(payload: unknown): payload is ModelTestPayload {
  return isRecord(payload) && isNonEmptyString(payload.modelId);
}

function isSettingsSetPayload(payload: unknown): payload is SettingsSetPayload {
  return (
    isRecord(payload) &&
    isNonEmptyString(payload.key) &&
    typeof payload.value === 'string'
  );
}

export function assertIpcPayload<Channel extends IpcChannel>(
  channel: Channel,
  payload: unknown
): asserts payload is IpcPayloadMap[Channel] {
  let valid = false;

  switch (channel) {
    case ipcChannels.bookCreate:
      valid = isBookCreatePayload(payload);
      break;
    case ipcChannels.bookDelete:
    case ipcChannels.bookDetail:
    case ipcChannels.bookStart:
    case ipcChannels.bookPause:
    case ipcChannels.bookWriteNext:
    case ipcChannels.bookWriteAll:
    case ipcChannels.bookResume:
    case ipcChannels.bookRestart:
      valid = hasBookId(payload);
      break;
    case ipcChannels.bookExport:
      valid = isBookExportPayload(payload);
      break;
    case ipcChannels.modelSave:
      valid = isModelSavePayload(payload);
      break;
    case ipcChannels.modelTest:
      valid = isModelTestPayload(payload);
      break;
    case ipcChannels.settingsGet:
      valid = payload === undefined || typeof payload === 'string';
      break;
    case ipcChannels.settingsSet:
      valid = isSettingsSetPayload(payload);
      break;
    default:
      valid = payload === undefined;
      break;
  }

  if (!valid) {
    throw new Error(`Invalid payload for ${channel}`);
  }
}
