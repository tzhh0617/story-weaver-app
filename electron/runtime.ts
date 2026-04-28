import { mkdirSync } from 'node:fs';
import { generateText } from 'ai';
import os from 'node:os';
import path from 'node:path';
import { createAiOutlineService } from '../src/core/ai-outline.js';
import {
  createAiCharacterStateExtractor,
  createAiPlotThreadExtractor,
  createAiSceneRecordExtractor,
  createAiSummaryGenerator,
} from '../src/core/ai-post-chapter.js';
import { createBookService } from '../src/core/book-service.js';
import { createDevelopmentOutlineService } from '../src/core/development-outline.js';
import { createNovelEngine } from '../src/core/engine.js';
import { createModelTestService } from '../src/core/model-test.js';
import { createScheduler } from '../src/core/scheduler.js';
import { createChapterWriter } from '../src/core/chapter-writer.js';
import { type ModelConfigInput } from '../src/models/config.js';
import { createRuntimeRegistry } from '../src/models/registry.js';
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

function getAvailableModelConfigs(
  persistedConfigs: ModelConfigInput[]
): ModelConfigInput[] {
  return [
    ...persistedConfigs,
    ...getEnvironmentModelConfigs().filter(
      (envConfig) =>
        !persistedConfigs.some((config) => config.id === envConfig.id)
    ),
  ];
}

function createDevelopmentChapterWriter() {
  return {
    async writeChapter(input: { modelId: string; prompt: string }) {
      const [, chapterLine = 'Untitled Chapter'] =
        input.prompt.match(/Chapter title: (.+)/) ?? [];
      const [, outlineLine = 'No outline'] =
        input.prompt.match(/Chapter outline: (.+)/) ?? [];

      return {
        content: [
          `${chapterLine}`,
          '',
          `This development-mode chapter expands the outline: ${outlineLine}.`,
          'It exists so the desktop flow can generate visible prose before the full long-running writing engine is wired in.',
        ].join('\n'),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
      };
    },
  };
}

function createDevelopmentSummaryGenerator() {
  return {
    async summarizeChapter(input: { modelId: string; content: string }) {
      const normalized = input.content.replace(/\s+/g, ' ').trim();
      return normalized.length > 120
        ? `${normalized.slice(0, 120)}...`
        : normalized;
    },
  };
}

function createDevelopmentCharacterStateExtractor() {
  return {
    async extractStates(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      if (input.content.toLowerCase().includes('debt')) {
        return [
          {
            characterId: 'protagonist',
            characterName: 'Lin Mo',
            location:
              input.chapterIndex > 1 ? 'Debt Court' : 'Rain Market',
            status:
              input.chapterIndex > 1
                ? 'Confronts the magistrate'
                : 'Investigating the debt ledger',
            knowledge:
              input.chapterIndex > 1
                ? 'Understands the larger scheme'
                : 'Knows the ledger is forged',
            emotion: input.chapterIndex > 1 ? 'Furious' : 'Suspicious',
            powerLevel: 'Awakened',
          },
        ];
      }

      return [];
    },
  };
}

function createDevelopmentSceneRecordExtractor() {
  return {
    async extractScene(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      if (input.content.toLowerCase().includes('debt')) {
        return {
          location:
            input.chapterIndex > 1 ? 'Debt Court' : 'Rain Market',
          timeInStory: input.chapterIndex > 1 ? 'Noon' : 'Night',
          charactersPresent: ['Lin Mo'],
          events:
            input.chapterIndex > 1
              ? 'Lin Mo confronts the magistrate'
              : 'Lin Mo discovers the forged ledger',
        };
      }

      return null;
    },
  };
}

function createDevelopmentPlotThreadExtractor() {
  return {
    async extractThreads(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const openedThreads = [];

      if (input.content.toLowerCase().includes('debt')) {
        openedThreads.push({
          id: `thread-${input.chapterIndex}-debt`,
          description: 'A hidden debt resurfaces later',
          plantedAt: input.chapterIndex,
          expectedPayoff: input.chapterIndex + 5,
          importance: 'critical',
        });
      }

      return {
        openedThreads,
        resolvedThreadIds: [],
      };
    },
  };
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
  const developmentOutlineService = createDevelopmentOutlineService();
  const developmentChapterWriter = createDevelopmentChapterWriter();
  const developmentSummaryGenerator = createDevelopmentSummaryGenerator();
  const developmentCharacterStateExtractor =
    createDevelopmentCharacterStateExtractor();
  const developmentPlotThreadExtractor = createDevelopmentPlotThreadExtractor();
  const developmentSceneRecordExtractor =
    createDevelopmentSceneRecordExtractor();
  const schedulerListeners = new Set<
    (status: {
      runningBookIds: string[];
      queuedBookIds: string[];
      pausedBookIds: string[];
      concurrencyLimit: number | null;
    }) => void
  >();
  const outlineService = {
    async generateFromIdea(input: {
      bookId: string;
      idea: string;
      targetWords: number;
      modelId: string;
    }) {
      const persistedConfigs = modelConfigs.list();
      const availableConfigs = getAvailableModelConfigs(persistedConfigs);

      if (availableConfigs.length === 0) {
        return developmentOutlineService.generateFromIdea(input);
      }

      try {
        const registry = createRuntimeRegistry(availableConfigs);
        return await createAiOutlineService({
          registry: registry as {
            languageModel: (modelId: string) => unknown;
          },
          generateText: generateText as (input: {
            model: unknown;
            prompt: string;
          }) => Promise<{ text: string }>,
        }).generateFromIdea(input);
      } catch (_error) {
        return developmentOutlineService.generateFromIdea(input);
      }
    },
  };
  const chapterWriter = {
    async writeChapter(input: { modelId: string; prompt: string }) {
      const persistedConfigs = modelConfigs.list();
      const availableConfigs = getAvailableModelConfigs(persistedConfigs);

      if (!availableConfigs.some((config) => config.id === input.modelId)) {
        return developmentChapterWriter.writeChapter(input);
      }

      try {
        const registry = createRuntimeRegistry(availableConfigs);
        const model = (registry as { languageModel: (id: string) => unknown }).languageModel(
          input.modelId
        );

        return await createChapterWriter({
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
      } catch (_error) {
        return developmentChapterWriter.writeChapter(input);
      }
    },
  };
  const summaryGenerator = {
    async summarizeChapter(input: { modelId: string; content: string }) {
      const persistedConfigs = modelConfigs.list();
      const availableConfigs = getAvailableModelConfigs(persistedConfigs);

      if (!availableConfigs.some((config) => config.id === input.modelId)) {
        return developmentSummaryGenerator.summarizeChapter(input);
      }

      try {
        const registry = createRuntimeRegistry(availableConfigs);
        return await createAiSummaryGenerator({
          registry: registry as {
            languageModel: (id: string) => unknown;
          },
          generateText: generateText as (input: {
            model: unknown;
            prompt: string;
          }) => Promise<{ text: string }>,
        }).summarizeChapter(input);
      } catch (_error) {
        return developmentSummaryGenerator.summarizeChapter(input);
      }
    },
  };
  const plotThreadExtractor = {
    async extractThreads(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const persistedConfigs = modelConfigs.list();
      const availableConfigs = getAvailableModelConfigs(persistedConfigs);

      if (!availableConfigs.some((config) => config.id === input.modelId)) {
        return developmentPlotThreadExtractor.extractThreads(input);
      }

      try {
        const registry = createRuntimeRegistry(availableConfigs);
        return await createAiPlotThreadExtractor({
          registry: registry as {
            languageModel: (id: string) => unknown;
          },
          generateText: generateText as (input: {
            model: unknown;
            prompt: string;
          }) => Promise<{ text: string }>,
        }).extractThreads(input);
      } catch (_error) {
        return developmentPlotThreadExtractor.extractThreads(input);
      }
    },
  };
  const characterStateExtractor = {
    async extractStates(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const persistedConfigs = modelConfigs.list();
      const availableConfigs = getAvailableModelConfigs(persistedConfigs);

      if (!availableConfigs.some((config) => config.id === input.modelId)) {
        return developmentCharacterStateExtractor.extractStates(input);
      }

      try {
        const registry = createRuntimeRegistry(availableConfigs);
        return await createAiCharacterStateExtractor({
          registry: registry as {
            languageModel: (id: string) => unknown;
          },
          generateText: generateText as (input: {
            model: unknown;
            prompt: string;
          }) => Promise<{ text: string }>,
        }).extractStates(input);
      } catch (_error) {
        return developmentCharacterStateExtractor.extractStates(input);
      }
    },
  };
  const sceneRecordExtractor = {
    async extractScene(input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const persistedConfigs = modelConfigs.list();
      const availableConfigs = getAvailableModelConfigs(persistedConfigs);

      if (!availableConfigs.some((config) => config.id === input.modelId)) {
        return developmentSceneRecordExtractor.extractScene(input);
      }

      try {
        const registry = createRuntimeRegistry(availableConfigs);
        return await createAiSceneRecordExtractor({
          registry: registry as {
            languageModel: (id: string) => unknown;
          },
          generateText: generateText as (input: {
            model: unknown;
            prompt: string;
          }) => Promise<{ text: string }>,
        }).extractScene(input);
      } catch (_error) {
        return developmentSceneRecordExtractor.extractScene(input);
      }
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
    resolveModelId: () => {
      const availableConfigs = getAvailableModelConfigs(modelConfigs.list());
      return availableConfigs[0]?.id ?? 'development:fallback';
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
      const persistedConfigs = modelConfigs.list();
      const availableConfigs = getAvailableModelConfigs(persistedConfigs);

      if (!availableConfigs.some((config) => config.id === modelId)) {
        return {
          ok: false,
          latency: 0,
          error: `Model not found: ${modelId}`,
        };
      }

      const registry = createRuntimeRegistry(availableConfigs);
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
