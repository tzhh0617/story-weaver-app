import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseBooleanSetting,
  SHORT_CHAPTER_REVIEW_ENABLED_KEY,
  shouldRewriteShortChapter,
} from '../src/core/chapter-review.js';
import { createBookService } from '../src/core/book-service.js';
import { buildIntegrityReport } from '../src/core/narrative/integrity.js';
import {
  createScheduler,
  type SchedulerTaskType,
} from '../src/core/scheduler.js';
import { buildAppPaths } from '../src/shared/paths.js';
import { createDatabase, createRepositories } from '../src/storage/database.js';
import { createModelConfigRepository } from '../src/storage/model-configs.js';
import { exportBookToFile } from '../src/storage/export.js';
import { createExecutionLogStream } from '../src/storage/logs.js';
import type {
  BookExportFormat,
  BookGenerationEvent,
  ExecutionLogDebugContext,
  ExecutionLogRecord,
} from '../src/shared/contracts.js';
import {
  LOG_MAX_FILE_SIZE_BYTES_KEY,
  LOG_RETENTION_DAYS_KEY,
} from '../src/shared/contracts.js';
import { createSettingsRepository } from '../src/storage/settings.js';
import { createRuntimeAiServices } from './runtime-ai-services.js';
import { runtimeConfig } from './runtime-env.js';

type RuntimeServices = {
  bookService: ReturnType<typeof createBookService>;
  modelConfigs: ReturnType<typeof createModelConfigRepository>;
  getModelConfig: () => ReturnType<
    ReturnType<typeof createModelConfigRepository>['getById']
  >;
  settings: ReturnType<typeof createSettingsRepository>;
  startBook: (bookId: string) => Promise<void>;
  pauseBook: (bookId: string) => void;
  writeNextChapter: (bookId: string) => Promise<unknown>;
  writeRemainingChapters: (bookId: string) => Promise<{
    completedChapters: number;
    status: 'completed' | 'paused' | 'deleted' | 'replanning';
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
};

let runtimeServices: RuntimeServices | null = null;

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

function parsePositiveIntegerSetting(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function getRuntimeServices() {
  if (runtimeServices) {
    return runtimeServices;
  }

  const rootDir = path.join(os.homedir(), '.story-weaver');
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
  const runtimeRunId = randomUUID();
  const logs = createExecutionLogStream({
    logDir: appPaths.logDir,
    runId: runtimeRunId,
    maxFileSizeBytes: parsePositiveIntegerSetting(
      settings.get(LOG_MAX_FILE_SIZE_BYTES_KEY),
      5 * 1024 * 1024
    ),
    retentionDays: parsePositiveIntegerSetting(
      settings.get(LOG_RETENTION_DAYS_KEY),
      14
    ),
  });
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
  let bookService!: ReturnType<typeof createBookService>;

  function getBookSnapshot(bookId: string) {
    const book = books.getById(bookId);

    return {
      bookId,
      bookTitle: book?.title ?? null,
    };
  }

  function logExecution(input: {
    bookId?: string | null;
    level: 'debug' | 'info' | 'success' | 'error';
    eventType: string;
    phase?: string | null;
    message: string;
    volumeIndex?: number | null;
    chapterIndex?: number | null;
    errorMessage?: string | null;
    errorStack?: string | null;
    durationMs?: number | null;
    debugContext?: ExecutionLogDebugContext | null;
  }) {
    logs.emit({
      ...(input.bookId ? getBookSnapshot(input.bookId) : {}),
      level: input.level,
      eventType: input.eventType,
      phase: input.phase ?? null,
      message: input.message,
      volumeIndex: input.volumeIndex ?? null,
      chapterIndex: input.chapterIndex ?? null,
      errorMessage: input.errorMessage ?? null,
      errorStack: input.errorStack ?? null,
      durationMs: input.durationMs ?? null,
      debugContext: input.debugContext ?? null,
    });
  }

  function getErrorStack(error: unknown) {
    return error instanceof Error ? error.stack ?? null : null;
  }

  const aiServices = createRuntimeAiServices({
    modelConfigs,
    onDebugLog: (entry) => {
      logExecution({
        level: entry.level,
        eventType: entry.eventType,
        phase: entry.phase ?? null,
        message: entry.message,
        errorMessage: entry.errorMessage ?? null,
        errorStack: entry.errorStack ?? null,
        durationMs: entry.durationMs ?? null,
        debugContext: entry.debugContext ?? null,
      });
    },
  });

  function classifyProgressEvent(event: Extract<BookGenerationEvent, { type: 'progress' }>) {
    if (/重写第 \d+ 章/.test(event.stepLabel)) {
      return 'chapter_rewriting';
    }
    if (event.phase === 'naming_title') {
      return 'book_title_generation';
    }
    if (event.phase === 'planning_init') {
      return 'planning_initialization';
    }
    if (event.phase === 'building_world') {
      return 'story_world_planning';
    }
    if (event.phase === 'building_outline') {
      return 'story_outline_planning';
    }
    if (event.phase === 'planning_arc') {
      return 'arc_planning';
    }
    if (event.phase === 'planning_chapters') {
      return 'chapter_planning';
    }
    if (event.phase === 'planning_recheck') {
      return 'chapter_replanning';
    }
    if (event.phase === 'writing') {
      return 'chapter_writing';
    }
    if (event.phase === 'auditing_chapter') {
      return 'chapter_auditing';
    }
    if (event.phase === 'revising_chapter') {
      return 'chapter_revision';
    }
    if (event.phase === 'extracting_continuity') {
      return 'chapter_continuity_extraction';
    }
    if (event.phase === 'extracting_state') {
      return 'chapter_state_extraction';
    }
    if (event.phase === 'checkpoint_review') {
      return 'narrative_checkpoint';
    }
    if (/写第 \d+ 章/.test(event.stepLabel)) {
      return 'chapter_writing';
    }

    return 'book_progress';
  }

  function buildRuntimeChapterIntegrityChecker() {
    return {
      inspectChapter: async (input: {
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        chapterTitle: string;
        chapterOutline: string;
        content: string;
        summary: string;
        auditScore: number | null;
        draftAttempts: number;
      }) => {
        const latestAudit = repositories.chapterAudits
          .listByChapter(input.bookId, input.volumeIndex, input.chapterIndex)
          .at(-1);
        const latestCheckpoint = repositories.narrativeCheckpoints
          .listByBook(input.bookId)
          .filter((checkpoint) => checkpoint.chapterIndex < input.chapterIndex)
          .at(-1);
        const checkpointReport =
          latestCheckpoint?.report &&
          typeof latestCheckpoint.report === 'object' &&
          latestCheckpoint.report !== null
            ? (latestCheckpoint.report as {
                replanningNotes?: string | null;
              })
            : null;

        const mainlineProblems =
          latestAudit?.issues
            .filter(
              (issue) =>
                issue.type === 'mainline_stall' ||
                issue.type === 'forbidden_move' ||
                issue.type === 'theme_drift'
            )
            .map((issue) => issue.evidence) ?? [];
        const characterProblems =
          latestAudit?.issues
            .filter(
              (issue) =>
                issue.type === 'character_logic' ||
                issue.type === 'relationship_static'
            )
            .map((issue) => issue.evidence) ?? [];
        const subplotProblems =
          latestAudit?.issues
            .filter((issue) => issue.type === 'thread_leak')
            .map((issue) => issue.evidence) ?? [];
        const payoffProblems =
          latestAudit?.issues
            .filter(
              (issue) =>
                issue.type === 'missing_payoff' ||
                issue.type === 'payoff_without_cost' ||
                issue.type === 'weak_reader_question'
            )
            .map((issue) => issue.evidence) ?? [];
        const rhythmProblems =
          latestAudit?.issues
            .filter(
              (issue) =>
                issue.type === 'pacing_problem' ||
                issue.type === 'chapter_too_empty' ||
                issue.type === 'flat_chapter' ||
                issue.type === 'weak_choice_pressure' ||
                issue.type === 'missing_consequence' ||
                issue.type === 'soft_hook' ||
                issue.type === 'repeated_tension_pattern'
            )
            .map((issue) => issue.evidence) ?? [];

        if ((input.auditScore ?? latestAudit?.score ?? 100) < 40) {
          rhythmProblems.push(
            `Audit score ${input.auditScore ?? latestAudit?.score} fell below runtime integrity floor`
          );
        }

        if (
          input.summary.trim().length < 20 &&
          (latestAudit?.decision === 'rewrite' || latestAudit?.decision === 'revise')
        ) {
          rhythmProblems.push(
            'Chapter summary is too thin to trust for downstream continuity'
          );
        }

        if (checkpointReport?.replanningNotes) {
          payoffProblems.push(checkpointReport.replanningNotes);
        }

        return buildIntegrityReport({
          mainlineProblems,
          characterProblems,
          subplotProblems,
          payoffProblems,
          rhythmProblems,
        });
      },
    };
  }

  function logGenerationEvent(event: BookGenerationEvent) {
    logExecution({
      bookId: event.bookId,
      level: 'debug',
      eventType: 'generation_event_received',
      phase:
        event.type === 'progress' || event.type === 'error' ? event.phase : null,
      message: `收到生成事件: ${event.type}`,
      volumeIndex:
        'currentVolume' in event
          ? event.currentVolume ?? null
          : 'volumeIndex' in event
            ? event.volumeIndex ?? null
            : null,
      chapterIndex:
        'currentChapter' in event
          ? event.currentChapter ?? null
          : 'chapterIndex' in event
            ? event.chapterIndex ?? null
            : null,
      debugContext: {
        generationEventType: event.type,
      },
    });

    if (event.type === 'progress') {
      logExecution({
        bookId: event.bookId,
        level: 'info',
        eventType: classifyProgressEvent(event),
        phase: event.phase,
        message: event.stepLabel,
        volumeIndex: event.currentVolume ?? null,
        chapterIndex: event.currentChapter ?? null,
      });
      return;
    }

    if (event.type === 'chapter-complete') {
      logExecution({
        bookId: event.bookId,
        level: 'success',
        eventType: 'chapter_completed',
        message: `第 ${event.chapterIndex} 章完成`,
        volumeIndex: event.volumeIndex,
        chapterIndex: event.chapterIndex,
      });
      return;
    }

    if (event.type === 'error') {
      logExecution({
        bookId: event.bookId,
        level: 'error',
        eventType: 'book_failed',
        phase: event.phase,
        message: event.stepLabel,
        volumeIndex: event.currentVolume ?? null,
        chapterIndex: event.currentChapter ?? null,
        errorMessage: event.error,
      });
    }
  }

  function currentSchedulerStatus() {
    const schedulerStatus = scheduler.getStatus();
    const activeRunningBookIds = bookService
      .listBooks()
      .filter(
        (book) =>
          schedulerStatus.runningBookIds.includes(book.id) &&
          book.status !== 'paused' &&
          book.status !== 'completed' &&
          book.status !== 'error'
      )
      .map((book) => book.id);
    const runningBookIds = [...new Set(activeRunningBookIds)];
    const runningBookIdSet = new Set(runningBookIds);
    const queuedBookIds = [...new Set(schedulerStatus.queuedBookIds)].filter(
      (bookId) => !runningBookIdSet.has(bookId)
    );

    return {
      ...schedulerStatus,
      runningBookIds,
      queuedBookIds,
      pausedBookIds: bookService
        .listBooks()
        .filter((book) => book.status === 'paused')
        .map((book) => book.id),
    };
  }

  function emitSchedulerStatus() {
    const status = currentSchedulerStatus();
    logExecution({
      level: 'debug',
      eventType: 'scheduler_status_snapshot',
      message: '调度状态已更新',
      debugContext: status,
    });
    for (const listener of schedulerListeners) {
      listener(status);
    }
  }

  function emitBookGeneration(event: BookGenerationEvent) {
    logGenerationEvent(event);

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

  function taskKeysForBook(bookId: string) {
    return {
      planning: `book:${bookId}:plan`,
      writing: `book:${bookId}:write`,
    };
  }

  function inferPlanningTaskType(bookId: string): SchedulerTaskType {
    const currentProgress = progress.getByBookId(bookId);
    const activeTaskType = currentProgress?.activeTaskType;

    if (
      activeTaskType === 'book:plan:init' ||
      activeTaskType === 'book:plan:rebuild-arc' ||
      activeTaskType === 'book:plan:rebuild-chapters'
    ) {
      return activeTaskType;
    }

    if (currentProgress?.phase === 'planning_arc') {
      return 'book:plan:rebuild-arc';
    }

    if (
      currentProgress?.phase === 'planning_chapters' ||
      currentProgress?.phase === 'planning_recheck'
    ) {
      return 'book:plan:rebuild-chapters';
    }

    return 'book:plan:init';
  }

  function registerRuntimeTasks(bookId: string) {
    const taskKeys = taskKeysForBook(bookId);
    const planningTaskType = inferPlanningTaskType(bookId);

    scheduler.register({
      taskKey: taskKeys.planning,
      bookId,
      taskType: planningTaskType,
      start: async () => runPlanningTask(bookId),
    });
    logExecution({
      bookId,
      level: 'debug',
      eventType: 'scheduler_task_registered',
      phase: 'planning_init',
      message: '注册后台规划任务',
      debugContext: {
        schedulerTaskKey: taskKeys.planning,
        taskType: planningTaskType,
      },
    });
    scheduler.register({
      taskKey: taskKeys.writing,
      bookId,
      taskType: 'book:write:chapter',
      start: async () => runWritingTask(bookId),
    });
    logExecution({
      bookId,
      level: 'debug',
      eventType: 'scheduler_task_registered',
      phase: 'writing',
      message: '注册后台写作任务',
      debugContext: {
        schedulerTaskKey: taskKeys.writing,
        taskType: 'book:write:chapter',
      },
    });

    return taskKeys;
  }

  function markBookErrored(bookId: string, error: unknown) {
    const currentProgress = progress.getByBookId(bookId);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stepLabel = currentProgress?.stepLabel ?? '后台执行失败';

    if (books.getById(bookId)) {
      books.updateStatus(bookId, 'error');
      progress.updatePhase(bookId, 'error', {
        currentVolume: currentProgress?.currentVolume ?? null,
        currentChapter: currentProgress?.currentChapter ?? null,
        stepLabel,
        errorMsg: errorMessage,
      });
    }

    emitBookGeneration({
      bookId,
      type: 'error',
      phase: 'error',
      stepLabel,
      error: errorMessage,
      currentVolume: currentProgress?.currentVolume ?? null,
      currentChapter: currentProgress?.currentChapter ?? null,
    });
    logExecution({
      bookId,
      level: 'debug',
      eventType: 'scheduler_task_failed',
      phase: currentProgress?.phase ?? 'error',
      message: '后台任务进入错误状态',
      errorMessage,
      errorStack: getErrorStack(error),
      debugContext: {
        stepLabel,
      },
    });
    emitSchedulerStatus();
  }

  async function queueWritingTaskAfterPlanning(bookId: string) {
    const taskKeys = taskKeysForBook(bookId);

    queueMicrotask(() => {
      const detail = bookService.getBookDetail(bookId);
      if (!detail) {
        return;
      }

      if (
        detail.book.status === 'paused' ||
        detail.book.status === 'completed' ||
        detail.book.status === 'error'
      ) {
        return;
      }

      logExecution({
        bookId,
        level: 'debug',
        eventType: 'scheduler_task_registered',
        phase: 'writing',
        message: '规划完成后准备排入写作任务',
        debugContext: {
          schedulerTaskKey: taskKeys.writing,
          trigger: 'planning_complete',
        },
      });
      void scheduler.start(taskKeys.writing).catch((error) => {
        markBookErrored(bookId, error);
      });
    });
  }

  async function runPlanningTask(bookId: string) {
    const startedAt = Date.now();
    try {
      logExecution({
        bookId,
        level: 'debug',
        eventType: 'scheduler_task_started',
        phase: 'planning_init',
        message: '开始执行后台规划任务',
        debugContext: {
          taskKey: taskKeysForBook(bookId).planning,
        },
      });
      logExecution({
        bookId,
        level: 'info',
        eventType: 'book_started',
        phase: 'planning_init',
        message: '开始后台规划作品',
      });
      await bookService.startBook(bookId);

      const detail = bookService.getBookDetail(bookId);
      if (!detail) {
        return;
      }

      if (detail.book.status === 'paused' || detail.book.status === 'error') {
        return;
      }

      await queueWritingTaskAfterPlanning(bookId);
      logExecution({
        bookId,
        level: 'debug',
        eventType: 'scheduler_task_completed',
        phase: 'planning_init',
        message: '后台规划任务完成',
        durationMs: Date.now() - startedAt,
        debugContext: {
          taskKey: taskKeysForBook(bookId).planning,
        },
      });
    } catch (error) {
      markBookErrored(bookId, error);
    }
  }

  async function runWritingTask(bookId: string) {
    const startedAt = Date.now();
    try {
      logExecution({
        bookId,
        level: 'debug',
        eventType: 'scheduler_task_started',
        phase: 'writing',
        message: '开始执行后台写作任务',
        debugContext: {
          taskKey: taskKeysForBook(bookId).writing,
        },
      });
      logExecution({
        bookId,
        level: 'info',
        eventType: 'book_started',
        phase: 'writing',
        message: '开始后台写作作品',
      });
      const result = await bookService.writeRemainingChapters(bookId);

      if (result.status === 'completed') {
        logExecution({
          bookId,
          level: 'success',
          eventType: 'book_completed',
          phase: 'completed',
          message: '后台执行完成',
        });
      }
      if (result.status === 'replanning') {
        logExecution({
          bookId,
          level: 'info',
          eventType: 'book_replanning',
          phase: 'planning_recheck',
          message: '后台执行进入重规划',
          debugContext: {
            completedChapters: result.completedChapters,
            status: result.status,
          },
        });
        await queueWritingTaskAfterPlanning(bookId);
      }
      logExecution({
        bookId,
        level: 'debug',
        eventType: 'scheduler_task_completed',
        phase: 'writing',
        message: '后台写作任务完成',
        durationMs: Date.now() - startedAt,
        debugContext: {
          taskKey: taskKeysForBook(bookId).writing,
          resultStatus: result.status,
          completedChapters: result.completedChapters,
        },
      });
    } catch (error) {
      markBookErrored(bookId, error);
    }
  }

  bookService = createBookService({
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
    chapterIntegrityChecker: buildRuntimeChapterIntegrityChecker(),
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

  runtimeServices = {
    bookService,
    modelConfigs,
    getModelConfig: () => {
      const modelConfig = runtimeConfig.modelConfig;
      if (!modelConfig) {
        return modelConfigs.list()[0] ?? null;
      }

      return modelConfigs.getById(modelConfig.id) ?? modelConfig;
    },
    settings,
    startBook: async (bookId: string) => {
      logExecution({
        bookId,
        level: 'info',
        eventType: 'book_queued',
        message: '作品已加入后台执行队列',
      });
      const taskKeys = registerRuntimeTasks(bookId);
      await scheduler.start(taskKeys.planning);
    },
    pauseBook: (bookId: string) => {
      bookService.pauseBook(bookId);
      logExecution({
        bookId,
        level: 'info',
        eventType: 'book_paused',
        phase: 'paused',
        message: '作品已暂停',
      });
      emitSchedulerStatus();
    },
    writeNextChapter: async (bookId: string) => {
      logExecution({
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
        logExecution({
          bookId,
          level: 'error',
          eventType: 'book_failed',
          phase: currentProgress?.phase ?? null,
          message: currentProgress?.stepLabel ?? '手动写下一章失败',
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: getErrorStack(error),
        });
        throw error;
      }
    },
    writeRemainingChapters: async (bookId: string) => {
      logExecution({
        bookId,
        level: 'info',
        eventType: 'book_write_all',
        phase: 'writing',
        message: '开始手动写完剩余章节',
      });

      try {
        const result = await bookService.writeRemainingChapters(bookId);
        if (result.status === 'completed') {
          logExecution({
            bookId,
            level: 'success',
            eventType: 'book_completed',
            phase: 'completed',
            message: '后台执行完成',
          });
        }
        if (result.status === 'replanning') {
          logExecution({
            bookId,
            level: 'info',
            eventType: 'book_replanning',
            phase: 'planning_recheck',
            message: '手动写作进入重规划',
            debugContext: {
              completedChapters: result.completedChapters,
              status: result.status,
            },
          });
        }

        return result;
      } catch (error) {
        const currentProgress = progress.getByBookId(bookId);
        logExecution({
          bookId,
          level: 'error',
          eventType: 'book_failed',
          phase: currentProgress?.phase ?? null,
          message: currentProgress?.stepLabel ?? '手动写完剩余章节失败',
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: getErrorStack(error),
        });
        throw error;
      }
    },
    resumeBook: async (bookId: string) => {
      logExecution({
        bookId,
        level: 'info',
        eventType: 'book_resumed',
        phase: 'writing',
        message: '作品已恢复后台执行',
      });
      const result = await bookService.resumeBook(bookId);
      if (result?.status === 'completed') {
        logExecution({
          bookId,
          level: 'success',
          eventType: 'book_completed',
          phase: 'completed',
          message: '后台执行完成',
        });
      }
      emitSchedulerStatus();
    },
    restartBook: async (bookId: string) => {
      logExecution({
        bookId,
        level: 'info',
        eventType: 'book_restarted',
        phase: 'building_outline',
        message: '作品已重新开始后台执行',
      });
      try {
        const result = await bookService.restartBook(bookId);
        if (result?.status === 'completed') {
          logExecution({
            bookId,
            level: 'success',
            eventType: 'book_completed',
            phase: 'completed',
            message: '后台执行完成',
          });
        }
      } catch (error) {
        markBookErrored(bookId, error);
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
        .filter((book) => book.status !== 'completed');
      const planningTaskKeys: string[] = [];

      logExecution({
        level: 'info',
        eventType: 'scheduler_start_all',
        message: `批量开始 ${runnableBooks.length} 本作品`,
      });

      for (const book of runnableBooks) {
        logExecution({
          bookId: book.id,
          level: 'info',
          eventType: 'book_queued',
          message: '作品已加入后台执行队列',
        });
        const taskKeys = registerRuntimeTasks(book.id);
        planningTaskKeys.push(taskKeys.planning);
      }

      await Promise.all(
        planningTaskKeys.map((taskKey) => scheduler.start(taskKey))
      );
    },
    pauseAllBooks: async () => {
      scheduler.pauseAll();

      const pausableBooks = bookService
        .listBooks()
        .filter(
          (book) => book.status !== 'completed' && book.status !== 'paused'
        );

      logExecution({
        level: 'info',
        eventType: 'scheduler_pause_all',
        message: `批量暂停 ${pausableBooks.length} 本作品`,
      });

      for (const book of pausableBooks) {
        bookService.pauseBook(book.id);
        logExecution({
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
  };

  return runtimeServices;
}
