import { mkdirSync } from 'node:fs';
import { generateText, streamText as streamModelText } from 'ai';
import os from 'node:os';
import path from 'node:path';
import { createAiOutlineService } from '../src/core/ai-outline.js';
import {
  parseBooleanSetting,
  SHORT_CHAPTER_REVIEW_ENABLED_KEY,
  shouldRewriteShortChapter,
} from '../src/core/chapter-review.js';
import {
  createAiChapterUpdateExtractor,
  createAiCharacterStateExtractor,
  createAiPlotThreadExtractor,
  createAiSceneRecordExtractor,
  createAiSummaryGenerator,
} from '../src/core/ai-post-chapter.js';
import { createBookService } from '../src/core/book-service.js';
import type { OutlineGenerationInput } from '../src/core/types.js';
import { createNovelEngine } from '../src/core/engine.js';
import { createModelTestService } from '../src/core/model-test.js';
import { createScheduler } from '../src/core/scheduler.js';
import { createChapterWriter } from '../src/core/chapter-writer.js';
import { type ModelConfigInput } from '../src/models/config.js';
import { createRuntimeRegistry } from '../src/models/registry.js';
import {
  createRuntimeMode,
  DEFAULT_MOCK_MODEL_ID,
} from '../src/models/runtime-mode.js';
import {
  createMockStoryServices,
} from '../src/mock/story-services.js';
import { buildAppPaths } from '../src/shared/paths.js';
import { createBookRepository } from '../src/storage/books.js';
import { createChapterRepository } from '../src/storage/chapters.js';
import { createCharacterRepository } from '../src/storage/characters.js';
import { createDatabase } from '../src/storage/database.js';
import { createModelConfigRepository } from '../src/storage/model-configs.js';
import { createPlotThreadRepository } from '../src/storage/plot-threads.js';
import { createProgressRepository } from '../src/storage/progress.js';
import { createSceneRecordRepository } from '../src/storage/scene-records.js';
import { exportBookToFile } from '../src/storage/export.js';
import { createExecutionLogStream } from '../src/storage/logs.js';
import type {
  BookExportFormat,
  BookGenerationEvent,
  ExecutionLogRecord,
} from '../src/shared/contracts.js';
import { createSettingsRepository } from '../src/storage/settings.js';

type RuntimeServices = {
  bookService: ReturnType<typeof createBookService>;
  modelConfigs: ReturnType<typeof createModelConfigRepository>;
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
};

let runtimeServices: RuntimeServices | null = null;
const DEFAULT_MOCK_RUNTIME_DELAY_MS = 1000;
const DEFAULT_MOCK_STREAM_TOKENS_PER_SECOND = 200;
const MOCK_STREAM_CHUNK_TOKENS = 40;

function parseMockRuntimeDelayMs(value: string | undefined) {
  if (value === undefined) {
    return DEFAULT_MOCK_RUNTIME_DELAY_MS;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MOCK_RUNTIME_DELAY_MS;
  }

  return parsed;
}

function parseMockStreamTokensPerSecond(value: string | undefined) {
  if (value === undefined) {
    return DEFAULT_MOCK_STREAM_TOKENS_PER_SECOND;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MOCK_STREAM_TOKENS_PER_SECOND;
  }

  return parsed;
}

function countMockStreamTokens(text: string) {
  let count = 0;

  for (const character of text) {
    if (!/\s/u.test(character)) {
      count += 1;
    }
  }

  return count;
}

function splitMockStreamChunks(text: string, maxTokens: number) {
  const chunks: string[] = [];
  let chunk = '';
  let tokenCount = 0;

  for (const character of text) {
    chunk += character;
    if (!/\s/u.test(character)) {
      tokenCount += 1;
    }

    if (tokenCount >= maxTokens) {
      chunks.push(chunk);
      chunk = '';
      tokenCount = 0;
    }
  }

  if (chunk) {
    chunks.push(chunk);
  }

  return chunks;
}

async function streamMockChapterContent(
  content: string,
  onChunk: (chunk: string) => void
) {
  const tokensPerSecond = parseMockStreamTokensPerSecond(
    process.env.STORY_WEAVER_MOCK_STREAM_TOKENS_PER_SECOND
  );
  const chunks = splitMockStreamChunks(content, MOCK_STREAM_CHUNK_TOKENS);

  for (const chunk of chunks) {
    const chunkTokens = countMockStreamTokens(chunk);
    const delayMs = Math.max(1, (chunkTokens / tokensPerSecond) * 1000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    onChunk(chunk);
  }
}

async function waitForMockRuntimeDelay() {
  const delayMs = parseMockRuntimeDelayMs(
    process.env.STORY_WEAVER_MOCK_DELAY_MS
  );

  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function withMockRuntimeDelay<T>(operation: () => Promise<T>) {
  const result = await operation();
  await waitForMockRuntimeDelay();
  return result;
}

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

function getEnvironmentModelConfigs(): ModelConfigInput[] {
  const configs: ModelConfigInput[] = [];

  if (process.env.OPENAI_API_KEY) {
    configs.push({
      id: 'openai:gpt-4o-mini',
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: '',
      config: {},
    });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    configs.push({
      id: 'anthropic:claude-3-5-sonnet',
      provider: 'anthropic',
      modelName: 'claude-3-5-sonnet',
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: '',
      config: {},
    });
  }

  return configs;
}

function getRuntimeModelMode(persistedConfigs: ModelConfigInput[]) {
  return createRuntimeMode({
    persistedConfigs,
    environmentConfigs: getEnvironmentModelConfigs(),
    fallbackModelId: DEFAULT_MOCK_MODEL_ID,
  });
}

function getRuntimeLanguageModel(input: {
  persistedConfigs: ModelConfigInput[];
  modelId: string;
}) {
  const runtimeMode = getRuntimeModelMode(input.persistedConfigs);

  if (runtimeMode.kind === 'mock') {
    throw new Error(`Model not found: ${input.modelId}`);
  }

  if (!runtimeMode.availableConfigs.some((config) => config.id === input.modelId)) {
    throw new Error(`Model not found: ${input.modelId}`);
  }

  const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
  return (registry as { languageModel: (id: string) => unknown }).languageModel(
    input.modelId
  );
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
  const books = createBookRepository(db);
  const chapters = createChapterRepository(db);
  const characters = createCharacterRepository(db);
  const plotThreads = createPlotThreadRepository(db);
  const sceneRecords = createSceneRecordRepository(db);
  const progress = createProgressRepository(db);
  const modelConfigs = createModelConfigRepository(db);
  const settings = createSettingsRepository(db);
  const logs = createExecutionLogStream();
  const mockServices = createMockStoryServices();
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
  const outlineService = {
    async generateTitleFromIdea(
      input: OutlineGenerationInput & { modelId: string }
    ) {
      const runtimeMode = getRuntimeModelMode(modelConfigs.list());
      if (runtimeMode.kind === 'mock') {
        return withMockRuntimeDelay(() =>
          mockServices.outlineService.generateTitleFromIdea(input)
        );
      }

      const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
      return createAiOutlineService({
        registry: registry as {
          languageModel: (modelId: string) => unknown;
        },
        generateText: generateText as (input: {
          model: unknown;
          prompt: string;
        }) => Promise<{ text: string }>,
      }).generateTitleFromIdea(input);
    },

    async generateFromIdea(
      input: OutlineGenerationInput & { modelId: string }
    ) {
      const runtimeMode = getRuntimeModelMode(modelConfigs.list());
      if (runtimeMode.kind === 'mock') {
        return withMockRuntimeDelay(() =>
          mockServices.outlineService.generateFromIdea(input)
        );
      }

      const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
      return createAiOutlineService({
        registry: registry as {
          languageModel: (modelId: string) => unknown;
        },
        generateText: generateText as (input: {
          model: unknown;
          prompt: string;
        }) => Promise<{ text: string }>,
      }).generateFromIdea(input);
    },
  };
  const chapterWriter = {
    async writeChapter(input: {
      modelId: string;
      prompt: string;
      onChunk?: (chunk: string) => void;
    }) {
      const persistedConfigs = modelConfigs.list();
      const runtimeMode = getRuntimeModelMode(persistedConfigs);
      if (runtimeMode.kind === 'mock') {
        return withMockRuntimeDelay(async () => {
          const result = await mockServices.chapterWriter.writeChapter(input);

          if (input.onChunk) {
            await streamMockChapterContent(result.content, input.onChunk);
          }

          return result;
        });
      }

      const model = getRuntimeLanguageModel({
        persistedConfigs,
        modelId: input.modelId,
      });

      return createChapterWriter({
        generateText: (payload: { prompt: string }) =>
          (generateText({
            model: model as never,
            prompt: payload.prompt,
          }) as Promise<{
            text: string;
            usage?: {
              inputTokens?: number;
              outputTokens?: number;
            };
          }>),
        streamText: (payload: { prompt: string }) =>
          streamModelText({
            model: model as never,
            prompt: payload.prompt,
          }).textStream,
      }).writeChapter({
        prompt: input.prompt,
        onChunk: input.onChunk,
      });
    },
  };
  const summaryGenerator = {
    async summarizeChapter(input: { modelId: string; content: string }) {
      const persistedConfigs = modelConfigs.list();
      const runtimeMode = getRuntimeModelMode(persistedConfigs);
      if (runtimeMode.kind === 'mock') {
        return mockServices.summaryGenerator.summarizeChapter(input);
      }

      const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
      return createAiSummaryGenerator({
        registry: registry as {
          languageModel: (id: string) => unknown;
        },
        generateText: generateText as (input: {
          model: unknown;
          prompt: string;
        }) => Promise<{ text: string }>,
      }).summarizeChapter(input);
    },
  };
  const plotThreadExtractor = {
    async extractThreads(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const persistedConfigs = modelConfigs.list();
      const runtimeMode = getRuntimeModelMode(persistedConfigs);
      if (runtimeMode.kind === 'mock') {
        return mockServices.plotThreadExtractor.extractThreads(input);
      }

      const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
      return createAiPlotThreadExtractor({
        registry: registry as {
          languageModel: (id: string) => unknown;
        },
        generateText: generateText as (input: {
          model: unknown;
          prompt: string;
        }) => Promise<{ text: string }>,
      }).extractThreads(input);
    },
  };
  const characterStateExtractor = {
    async extractStates(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const persistedConfigs = modelConfigs.list();
      const runtimeMode = getRuntimeModelMode(persistedConfigs);
      if (runtimeMode.kind === 'mock') {
        return mockServices.characterStateExtractor.extractStates(input);
      }

      const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
      return createAiCharacterStateExtractor({
        registry: registry as {
          languageModel: (id: string) => unknown;
        },
        generateText: generateText as (input: {
          model: unknown;
          prompt: string;
        }) => Promise<{ text: string }>,
      }).extractStates(input);
    },
  };
  const sceneRecordExtractor = {
    async extractScene(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const persistedConfigs = modelConfigs.list();
      const runtimeMode = getRuntimeModelMode(persistedConfigs);
      if (runtimeMode.kind === 'mock') {
        return mockServices.sceneRecordExtractor.extractScene(input);
      }

      const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
      return createAiSceneRecordExtractor({
        registry: registry as {
          languageModel: (id: string) => unknown;
        },
        generateText: generateText as (input: {
          model: unknown;
          prompt: string;
        }) => Promise<{ text: string }>,
      }).extractScene(input);
    },
  };
  const chapterUpdateExtractor = {
    async extractChapterUpdate(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const persistedConfigs = modelConfigs.list();
      const runtimeMode = getRuntimeModelMode(persistedConfigs);
      if (runtimeMode.kind === 'mock') {
        return mockServices.chapterUpdateExtractor.extractChapterUpdate(input);
      }

      const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
      return createAiChapterUpdateExtractor({
        registry: registry as {
          languageModel: (id: string) => unknown;
        },
        generateText: generateText as (input: {
          model: unknown;
          prompt: string;
        }) => Promise<{ text: string }>,
      }).extractChapterUpdate(input);
    },
  };
  const runningBookIds = new Set<string>();
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
    level: 'info' | 'success' | 'error';
    eventType: string;
    phase?: string | null;
    message: string;
    volumeIndex?: number | null;
    chapterIndex?: number | null;
    errorMessage?: string | null;
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
    });
  }

  function logGenerationEvent(event: BookGenerationEvent) {
    if (event.type === 'progress') {
      logExecution({
        bookId: event.bookId,
        level: 'info',
        eventType: 'book_progress',
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

  async function runBook(bookId: string) {
    runningBookIds.add(bookId);
    try {
      logExecution({
        bookId,
        level: 'info',
        eventType: 'book_started',
        phase: 'building_world',
        message: '开始后台执行作品',
      });
      await createEngineForBook(bookId).start();

      const book = books.getById(bookId);
      if (book?.status === 'completed') {
        logExecution({
          bookId,
          level: 'success',
          eventType: 'book_completed',
          phase: 'completed',
          message: '后台执行完成',
        });
      }
    } catch (error) {
      const currentProgress = progress.getByBookId(bookId);
      logExecution({
        bookId,
        level: 'error',
        eventType: 'book_failed',
        phase: currentProgress?.phase ?? null,
        message: currentProgress?.stepLabel ?? '后台执行失败',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      runningBookIds.delete(bookId);
    }
  }

  bookService = createBookService({
    books,
    chapters,
    characters,
    plotThreads,
    sceneRecords,
    progress,
    outlineService,
    chapterWriter,
    summaryGenerator,
    characterStateExtractor,
    plotThreadExtractor,
    sceneRecordExtractor,
    chapterUpdateExtractor,
    shouldRewriteShortChapter: ({ content, wordsPerChapter }) =>
      shouldRewriteShortChapter({
        enabled: parseBooleanSetting(
          settings.get(SHORT_CHAPTER_REVIEW_ENABLED_KEY)
        ),
        content,
        wordsPerChapter,
      }),
    resolveModelId: () => {
      const runtimeMode = getRuntimeModelMode(modelConfigs.list());
      return runtimeMode.resolveModelId();
    },
    onBookUpdated: () => {
      emitSchedulerStatus();
    },
    onGenerationEvent: emitBookGeneration,
  });

  runtimeServices = {
    bookService,
    modelConfigs,
    settings,
    startBook: async (bookId: string) => {
      logExecution({
        bookId,
        level: 'info',
        eventType: 'book_queued',
        message: '作品已加入后台执行队列',
      });
      scheduler.register({
        bookId,
        start: async () => runBook(bookId),
      });
      await scheduler.start(bookId);
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
        scheduler.register({
          bookId: book.id,
          start: async () => runBook(book.id),
        });
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
    testModel: async (modelId: string) => {
      const runtimeMode = getRuntimeModelMode(modelConfigs.list());

      if (
        runtimeMode.kind === 'mock' ||
        !runtimeMode.availableConfigs.some((config) => config.id === modelId)
      ) {
        return {
          ok: false,
          latency: 0,
          error: `Model not found: ${modelId}`,
        };
      }

      const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
      return createModelTestService({
        registry: registry as {
          languageModel: (id: string) => unknown;
        },
        generateText: generateText as (input: {
          model: unknown;
          prompt: string;
        }) => Promise<{ text: string }>,
      }).testModel(modelId);
    },
  };

  return runtimeServices;
}
