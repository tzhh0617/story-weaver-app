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
      viralStoryProtocol?: {
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
      } | null;
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
      report: Record<string, unknown> | null;
      futureCardRevisions: Array<Record<string, unknown>>;
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
  } | null;
};

export type SchedulerStatus = {
  runningBookIds: string[];
  queuedBookIds: string[];
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

export type ExecutionLogLevel = 'info' | 'success' | 'error';

export type ExecutionLogRecord = {
  id: number;
  bookId: string | null;
  bookTitle: string | null;
  level: ExecutionLogLevel;
  eventType: string;
  phase: string | null;
  message: string;
  volumeIndex: number | null;
  chapterIndex: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export type BookExportFormat = 'txt' | 'md';

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

export type BookCreateRequest = BookCreatePayload;

export type BookCreateResponse = {
  bookId: string;
};

export type BookExportRequest = Pick<BookExportPayload, 'format'>;

export type BookExportResponse = {
  filePath: string;
  downloadUrl: string;
};

export type ModelSaveRequest = ModelSavePayload;

export type ModelTestResponse = {
  ok: boolean;
  latency: number;
  error: string | null;
};

export type SettingValueResponse = {
  key: string;
  value: string | null;
};

export type OkResponse = {
  ok: true;
};
