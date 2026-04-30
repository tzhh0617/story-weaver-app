export type BookStatus =
  | 'creating'
  | 'building_world'
  | 'building_outline'
  | 'writing'
  | 'paused'
  | 'completed'
  | 'error';

export type BookRecord = {
  id: string;
  title: string;
  idea: string;
  status: BookStatus;
  targetChapters: number;
  wordsPerChapter: number;
  createdAt: string;
  updatedAt: string;
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
