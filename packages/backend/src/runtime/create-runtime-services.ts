import { mkdirSync } from 'node:fs';
import {
  parseBooleanSetting,
  SHORT_CHAPTER_REVIEW_ENABLED_KEY,
  shouldRewriteShortChapter,
} from '../core/chapter-review.js';
import { createBookOrchestrator } from '../core/orchestrator.js';
import { createNovelEngine } from '../core/engine.js';
import { createScheduler } from '../core/scheduler.js';
import { buildAppPaths } from '../shared/paths.js';
import { createDatabase, createRepositories } from '../storage/database.js';
import { createModelConfigRepository } from '../storage/model-configs.js';
import { createExecutionLogStream } from '../storage/logs.js';
import type {
  BookExportFormat,
  BookGenerationEvent,
  ExecutionLogRecord,
} from '@story-weaver/shared/contracts';
import type { ModelConfigInput } from '../models/config.js';
import { resolveEnvironmentModelConfigs } from '../models/environment-config.js';
import { createRuntimeMode } from '../models/runtime-mode.js';
import { createSettingsRepository } from '../storage/settings.js';
import { createRuntimeAiServices } from './runtime-ai-services.js';
import { createLoggingService } from './create-logging-service.js';
import { createBookRunner } from './create-book-runner.js';
import {
  createEventBroadcastService,
  type SchedulerStatusView,
} from './create-event-broadcast-service.js';
import { createBatchOperationsService } from './create-batch-operations-service.js';
import { createBookExportService } from './create-book-export-service.js';
import { createBookActionService } from './create-book-action-service.js';

export type RuntimeServices = {
  bookService: ReturnType<typeof createBookOrchestrator>;
  modelConfigs: ReturnType<typeof createModelConfigRepository>;
  listModelConfigs: () => ModelConfigInput[];
  settings: ReturnType<typeof createSettingsRepository>;
  startBook: (bookId: string) => Promise<void>;
  pauseBook: (bookId: string) => void;
  writeNextChapter: (bookId: string) => Promise<unknown>;
  writeRemainingChapters: (bookId: string) => Promise<{
    completedChapters: number;
    status: 'completed' | 'paused' | 'deleted';
  }>;
  resumeBook: (bookId: string) => Promise<void>;
  restartBook: (bookId: string) => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
  exportBook: (bookId: string, format: BookExportFormat) => Promise<string>;
  startAllBooks: () => Promise<void>;
  pauseAllBooks: () => Promise<void>;
  setSchedulerConcurrencyLimit: (limit: number | null) => void;
  getSchedulerStatus: () => SchedulerStatusView;
  subscribeSchedulerStatus: (
    listener: (status: SchedulerStatusView) => void
  ) => () => void;
  subscribeBookGeneration: (
    listener: (event: BookGenerationEvent) => void
  ) => () => void;
  subscribeExecutionLogs: (
    listener: (event: ExecutionLogRecord) => void
  ) => () => void;
  testModel: (modelId: string) => Promise<{
    ok: boolean;
    latency: number;
    error: string | null;
  }>;
  close: () => void;
};

function parseConcurrencyLimit(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

export function createRuntimeServices(input: {
  rootDir: string;
}): RuntimeServices {
  const rootDir = input.rootDir;
  const appPaths = buildAppPaths(rootDir);

  mkdirSync(rootDir, { recursive: true });
  mkdirSync(appPaths.exportDir, { recursive: true });
  mkdirSync(appPaths.logDir, { recursive: true });

  const db = createDatabase(appPaths.databaseFile);
  const repositories = createRepositories(db);
  const books = repositories.books;
  const chapters = repositories.chapters;
  const characters = repositories.characters;
  const plotThreads = repositories.plotThreads;
  const sceneRecords = repositories.sceneRecords;
  const progress = repositories.progress;
  const modelConfigs = repositories.modelConfigs;
  const settings = repositories.settings;
  const logs = createExecutionLogStream();
  const aiServices = createRuntimeAiServices({ modelConfigs });
  const runningBookIds = new Set<string>();
  let scheduler: ReturnType<typeof createScheduler>;
  let bookService!: ReturnType<typeof createBookOrchestrator>;

  function listModelConfigs() {
    const environmentConfigs = resolveEnvironmentModelConfigs();
    const runtimeMode = createRuntimeMode({
      persistedConfigs: modelConfigs.list(),
      environmentConfigs: environmentConfigs.configs,
      preferEnvironmentConfigs: environmentConfigs.preferEnvironmentConfigs,
    });

    return runtimeMode.availableConfigs;
  }

  const logging = createLoggingService({ books, logs });

  const eventBroadcast = createEventBroadcastService({
    getSchedulerStatus: () => scheduler.getStatus(),
    getBooks: () => bookService.listBooks(),
    logging,
  });

  scheduler = createScheduler({
    concurrencyLimit: parseConcurrencyLimit(
      settings.get('scheduler.concurrencyLimit')
    ),
    onStatusChange: () => {
      eventBroadcast.emitSchedulerStatus();
    },
  });

  function createEngineForBook(bookId: string) {
    return createNovelEngine({
      bookId,
      buildOutline: async (id) => {
        await bookService.startBook(id);
      },
      continueWriting: async (id) => bookService.writeRemainingChapters(id),
      isBookActive: (id) => bookService.getBookDetail(id) !== null,
      repositories: {
        progress,
      },
    });
  }

  bookService = createBookOrchestrator({
    books,
    chapters,
    characters,
    plotThreads,
    storyBibles: repositories.storyBibles,
    characterArcs: repositories.characterArcs,
    relationshipEdges: repositories.relationshipEdges,
    worldRules: repositories.worldRules,
    narrativeThreads: repositories.narrativeThreads,
    volumePlans: repositories.volumePlans,
    chapterCards: repositories.chapterCards,
    chapterTensionBudgets: repositories.chapterTensionBudgets,
    chapterAudits: repositories.chapterAudits,
    relationshipStates: repositories.relationshipStates,
    narrativeCheckpoints: repositories.narrativeCheckpoints,
    sceneRecords,
    progress,
    outlineService: aiServices.outlineService,
    chapterWriter: aiServices.chapterWriter,
    summaryGenerator: aiServices.summaryGenerator,
    characterStateExtractor: aiServices.characterStateExtractor,
    plotThreadExtractor: aiServices.plotThreadExtractor,
    sceneRecordExtractor: aiServices.sceneRecordExtractor,
    chapterUpdateExtractor: aiServices.chapterUpdateExtractor,
    chapterAuditor: aiServices.chapterAuditor,
    chapterRevision: aiServices.chapterRevision,
    narrativeStateExtractor: aiServices.narrativeStateExtractor,
    narrativeCheckpoint: aiServices.narrativeCheckpoint,
    shouldRewriteShortChapter: ({ content, wordsPerChapter }) =>
      shouldRewriteShortChapter({
        enabled: parseBooleanSetting(
          settings.get(SHORT_CHAPTER_REVIEW_ENABLED_KEY)
        ),
        content,
        wordsPerChapter,
      }),
    resolveModelId: aiServices.resolveModelId,
    onBookUpdated: () => {
      eventBroadcast.emitSchedulerStatus();
    },
    onGenerationEvent: eventBroadcast.emitBookGeneration,
  });

  const bookRunner = createBookRunner({
    books,
    progress,
    bookService,
    logExecution: logging.logExecution,
    emitBookGeneration: eventBroadcast.emitBookGeneration,
    emitSchedulerStatus: eventBroadcast.emitSchedulerStatus,
    scheduler,
    runningBookIds,
    createEngineForBook,
  });

  const bookActions = createBookActionService({
    bookService,
    bookRunner,
    scheduler,
    progress,
    logging,
    emitSchedulerStatus: eventBroadcast.emitSchedulerStatus,
  });

  const batchOps = createBatchOperationsService({
    bookService,
    logging,
    bookRunner,
    scheduler,
    emitSchedulerStatus: eventBroadcast.emitSchedulerStatus,
  });

  const exportService = createBookExportService({
    bookService,
    exportDir: appPaths.exportDir,
  });

  let closed = false;

  return {
    bookService,
    modelConfigs,
    listModelConfigs,
    settings,
    startBook: bookActions.startBook,
    pauseBook: bookActions.pauseBook,
    writeNextChapter: bookActions.writeNextChapter,
    writeRemainingChapters: bookActions.writeRemainingChapters,
    resumeBook: bookActions.resumeBook,
    restartBook: bookActions.restartBook,
    deleteBook: bookActions.deleteBook,
    exportBook: exportService.exportBook,
    startAllBooks: batchOps.startAllBooks,
    pauseAllBooks: batchOps.pauseAllBooks,
    setSchedulerConcurrencyLimit: (limit: number | null) => {
      scheduler.setConcurrencyLimit(limit);
      eventBroadcast.emitSchedulerStatus();
    },
    getSchedulerStatus: () => eventBroadcast.currentSchedulerStatus(),
    subscribeSchedulerStatus: eventBroadcast.subscribeSchedulerStatus,
    subscribeBookGeneration: eventBroadcast.subscribeBookGeneration,
    subscribeExecutionLogs: (listener) => logs.subscribe(listener),
    testModel: aiServices.testModel,
    close: () => {
      if (closed) {
        return;
      }

      closed = true;
      scheduler.pauseAll();
      eventBroadcast.clear();
      runningBookIds.clear();
      db.close();
    },
  };
}
