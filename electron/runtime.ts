import { mkdirSync } from 'node:fs';
import { generateText } from 'ai';
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
import type { BookExportFormat } from '../src/shared/contracts.js';
import { createSettingsRepository } from '../src/storage/settings.js';

type RuntimeServices = {
  bookService: ReturnType<typeof createBookService>;
  modelConfigs: ReturnType<typeof createModelConfigRepository>;
  settings: ReturnType<typeof createSettingsRepository>;
  startBook: (bookId: string) => Promise<void>;
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
  testModel: (modelId: string) => Promise<{
    ok: boolean;
    latency: number;
    error: string | null;
  }>;
};

let runtimeServices: RuntimeServices | null = null;
const DEFAULT_MOCK_RUNTIME_DELAY_MS = 1000;

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
  const mockServices = createMockStoryServices();
  const schedulerListeners = new Set<
    (status: {
      runningBookIds: string[];
      queuedBookIds: string[];
      pausedBookIds: string[];
      concurrencyLimit: number | null;
    }) => void
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
    async writeChapter(input: { modelId: string; prompt: string }) {
      const persistedConfigs = modelConfigs.list();
      const runtimeMode = getRuntimeModelMode(persistedConfigs);
      if (runtimeMode.kind === 'mock') {
        return withMockRuntimeDelay(() =>
          mockServices.chapterWriter.writeChapter(input)
        );
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
      }).writeChapter({
        prompt: input.prompt,
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
      await createEngineForBook(bookId).start();
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
  });

  runtimeServices = {
    bookService,
    modelConfigs,
    settings,
    startBook: async (bookId: string) => {
      scheduler.register({
        bookId,
        start: async () => runBook(bookId),
      });
      await scheduler.start(bookId);
    },
    resumeBook: async (bookId: string) => {
      await bookService.resumeBook(bookId);
      emitSchedulerStatus();
    },
    restartBook: async (bookId: string) => {
      await bookService.restartBook(bookId);
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

      for (const book of runnableBooks) {
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

      for (const book of pausableBooks) {
        bookService.pauseBook(book.id);
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
