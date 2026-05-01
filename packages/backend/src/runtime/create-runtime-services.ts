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
import { exportBookToFile } from '../storage/export.js';
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
  getSchedulerStatus: () => {
    runningBookIds: string[];
    queuedBookIds: string[];
    pausedBookIds: string[];
    concurrencyLimit: number | null;
  };
  subscribeSchedulerStatus: (
    listener: (status: {
      runningBookIds: string[];
      queuedBookIds: string[];
      pausedBookIds: string[];
      concurrencyLimit: number | null;
    }) => void
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
  const schedulerListeners = new Set<
    (status: {
      runningBookIds: string[];
      queuedBookIds: string[];
      pausedBookIds: string[];
      concurrencyLimit: number | null;
    }) => void
  >();
  const bookGenerationListeners = new Set<
    (event: BookGenerationEvent) => void
  >();
  const runningBookIds = new Set<string>();
  let bookService!: ReturnType<typeof createBookOrchestrator>;
  let closed = false;

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

  function currentSchedulerStatus() {
    const schedulerStatus = scheduler.getStatus();
    return {
      ...schedulerStatus,
      pausedBookIds: bookService
        .listBooks()
        .filter((book) => book.status === 'paused')
        .map((book) => book.id),
    };
  }

  function emitSchedulerStatus() {
    const status = currentSchedulerStatus();
    for (const listener of schedulerListeners) {
      listener(status);
    }
  }

  function emitBookGeneration(event: BookGenerationEvent) {
    logging.logGenerationEvent(event);

    for (const listener of bookGenerationListeners) {
      listener(event);
    }
  }

  const scheduler = createScheduler({
    concurrencyLimit: parseConcurrencyLimit(
      settings.get('scheduler.concurrencyLimit')
    ),
    onStatusChange: () => {
      emitSchedulerStatus();
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
      emitSchedulerStatus();
    },
    onGenerationEvent: emitBookGeneration,
  });

  const bookRunner = createBookRunner({
    books,
    progress,
    bookService,
    logExecution: logging.logExecution,
    emitBookGeneration,
    emitSchedulerStatus,
    scheduler,
    runningBookIds,
    createEngineForBook,
  });

  return {
    bookService,
    modelConfigs,
    listModelConfigs,
    settings,
    startBook: async (bookId: string) => {
      logging.logExecution({
        bookId,
        level: 'info',
        eventType: 'book_queued',
        message: '作品已加入后台执行队列',
      });
      scheduler.register({
        bookId,
        start: async () => bookRunner.runBook(bookId),
      });
      await scheduler.start(bookId);
    },
    pauseBook: (bookId: string) => {
      bookService.pauseBook(bookId);
      logging.logExecution({
        bookId,
        level: 'info',
        eventType: 'book_paused',
        phase: 'paused',
        message: '作品已暂停',
      });
      emitSchedulerStatus();
    },
    writeNextChapter: async (bookId: string) => {
      logging.logExecution({
        bookId,
        level: 'info',
        eventType: 'book_write_next',
        phase: 'writing',
        message: '开始手动写下一章',
      });

      try {
        return await bookService.writeNextChapter(bookId);
      } catch (error) {
        const currentProgress = progress.getByBookId(bookId);
        logging.logExecution({
          bookId,
          level: 'error',
          eventType: 'book_failed',
          phase: currentProgress?.phase ?? null,
          message: currentProgress?.stepLabel ?? '手动写下一章失败',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    writeRemainingChapters: async (bookId: string) => {
      logging.logExecution({
        bookId,
        level: 'info',
        eventType: 'book_write_all',
        phase: 'writing',
        message: '开始手动写完剩余章节',
      });

      try {
        const result = await bookService.writeRemainingChapters(bookId);
        if (result.status === 'completed') {
          logging.logExecution({
            bookId,
            level: 'success',
            eventType: 'book_completed',
            phase: 'completed',
            message: '后台执行完成',
          });
        }

        return result;
      } catch (error) {
        const currentProgress = progress.getByBookId(bookId);
        logging.logExecution({
          bookId,
          level: 'error',
          eventType: 'book_failed',
          phase: currentProgress?.phase ?? null,
          message: currentProgress?.stepLabel ?? '手动写完剩余章节失败',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    resumeBook: async (bookId: string) => {
      logging.logExecution({
        bookId,
        level: 'info',
        eventType: 'book_resumed',
        phase: 'writing',
        message: '作品已恢复后台执行',
      });
      scheduler.register({
        bookId,
        start: async () => bookRunner.continueBook(bookId),
      });
      await scheduler.start(bookId);
    },
    restartBook: async (bookId: string) => {
      logging.logExecution({
        bookId,
        level: 'info',
        eventType: 'book_restarted',
        phase: 'building_outline',
        message: '作品已重新开始后台执行',
      });
      try {
        const result = await bookService.restartBook(bookId);
        if (result?.status === 'completed') {
          logging.logExecution({
            bookId,
            level: 'success',
            eventType: 'book_completed',
            phase: 'completed',
            message: '后台执行完成',
          });
        }
      } catch (error) {
        bookRunner.markBookErrored(bookId, error);
        throw error;
      }
      emitSchedulerStatus();
    },
    deleteBook: async (bookId: string) => {
      scheduler.unregister(bookId);
      bookService.deleteBook(bookId);
      emitSchedulerStatus();
    },
    exportBook: async (bookId: string, format: BookExportFormat) => {
      const detail = bookService.getBookDetail(bookId);

      if (!detail) {
        throw new Error(`Book not found: ${bookId}`);
      }

      const result = await exportBookToFile({
        exportDir: appPaths.exportDir,
        format,
        title: detail.book.title,
        chapters: detail.chapters.map((chapter) => ({
          chapterIndex: chapter.chapterIndex,
          title: chapter.title,
          content: chapter.content,
        })),
      });

      return result.filePath;
    },
    startAllBooks: async () => {
      const runnableBooks = bookService
        .listBooks()
        .filter((book) => book.status !== 'completed' && book.status !== 'paused');

      logging.logExecution({
        level: 'info',
        eventType: 'scheduler_start_all',
        message: `批量开始 ${runnableBooks.length} 本作品`,
      });

      for (const book of runnableBooks) {
        logging.logExecution({
          bookId: book.id,
          level: 'info',
          eventType: 'book_queued',
          message: '作品已加入后台执行队列',
        });
        bookRunner.registerBackgroundRunner(book);
      }

      await scheduler.startAll();
    },
    pauseAllBooks: async () => {
      scheduler.pauseAll();

      const pausableBooks = bookService
        .listBooks()
        .filter(
          (book) => book.status !== 'completed' && book.status !== 'paused'
        );

      logging.logExecution({
        level: 'info',
        eventType: 'scheduler_pause_all',
        message: `批量暂停 ${pausableBooks.length} 本作品`,
      });

      for (const book of pausableBooks) {
        bookService.pauseBook(book.id);
        logging.logExecution({
          bookId: book.id,
          level: 'info',
          eventType: 'book_paused',
          phase: 'paused',
          message: '作品已暂停',
        });
      }

      emitSchedulerStatus();
    },
    setSchedulerConcurrencyLimit: (limit: number | null) => {
      scheduler.setConcurrencyLimit(limit);
      emitSchedulerStatus();
    },
    getSchedulerStatus: () => currentSchedulerStatus(),
    subscribeSchedulerStatus: (listener) => {
      schedulerListeners.add(listener);
      listener(currentSchedulerStatus());
      return () => {
        schedulerListeners.delete(listener);
      };
    },
    subscribeBookGeneration: (listener) => {
      bookGenerationListeners.add(listener);
      return () => {
        bookGenerationListeners.delete(listener);
      };
    },
    subscribeExecutionLogs: (listener) => logs.subscribe(listener),
    testModel: aiServices.testModel,
    close: () => {
      if (closed) {
        return;
      }

      closed = true;
      scheduler.pauseAll();
      schedulerListeners.clear();
      bookGenerationListeners.clear();
      runningBookIds.clear();
      db.close();
    },
  };
}
