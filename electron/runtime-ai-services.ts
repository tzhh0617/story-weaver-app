import { generateText, streamText as streamModelText } from 'ai';
import {
  createAiChapterUpdateExtractor,
  createAiChapterAuditor,
  createAiChapterRevision,
  createAiCharacterStateExtractor,
  createAiNarrativeStateExtractor,
  createAiPlotThreadExtractor,
  createAiSceneRecordExtractor,
  createAiSummaryGenerator,
} from '../src/core/ai-post-chapter.js';
import { createAiOutlineService } from '../src/core/ai-outline.js';
import { createChapterWriter } from '../src/core/chapter-writer.js';
import { createModelTestService } from '../src/core/model-test.js';
import type { NarrativeAudit } from '../src/core/narrative/types.js';
import type { OutlineGenerationInput } from '../src/core/types.js';
import { type ModelConfigInput } from '../src/models/config.js';
import { createRuntimeRegistry } from '../src/models/registry.js';
import {
  createRuntimeMode,
  DEFAULT_MOCK_MODEL_ID,
} from '../src/models/runtime-mode.js';
import { createMockStoryServices } from '../src/mock/story-services.js';
import {
  runtimeConfig,
} from './runtime-env.js';

const MOCK_STREAM_CHUNK_TOKENS = 40;

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
  const tokensPerSecond = runtimeConfig.mockStreamTokensPerSecond;
  const chunks = splitMockStreamChunks(content, MOCK_STREAM_CHUNK_TOKENS);

  for (const chunk of chunks) {
    const chunkTokens = countMockStreamTokens(chunk);
    const delayMs = Math.max(1, (chunkTokens / tokensPerSecond) * 1000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    onChunk(chunk);
  }
}

async function waitForMockRuntimeDelay() {
  const delayMs = runtimeConfig.mockRuntimeDelayMs;

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

function getEnvironmentModelConfigs(): ModelConfigInput[] {
  return runtimeConfig.environmentModelConfigs;
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

export function createRuntimeAiServices(input: {
  modelConfigs: {
    list: () => ModelConfigInput[];
  };
}) {
  const { modelConfigs } = input;
  const mockServices = createMockStoryServices();

  const outlineService = {
    async generateTitleFromIdea(
      outlineInput: OutlineGenerationInput & { modelId: string }
    ) {
      const runtimeMode = getRuntimeModelMode(modelConfigs.list());
      if (runtimeMode.kind === 'mock') {
        return withMockRuntimeDelay(() =>
          mockServices.outlineService.generateTitleFromIdea(outlineInput)
        );
      }

      const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
      return createAiOutlineService({
        registry: registry as {
          languageModel: (modelId: string) => unknown;
        },
        generateText: generateText as (payload: {
          model: unknown;
          prompt: string;
        }) => Promise<{ text: string }>,
      }).generateTitleFromIdea(outlineInput);
    },

    async generateFromIdea(
      outlineInput: OutlineGenerationInput & { modelId: string }
    ) {
      const runtimeMode = getRuntimeModelMode(modelConfigs.list());
      if (runtimeMode.kind === 'mock') {
        return withMockRuntimeDelay(() =>
          mockServices.outlineService.generateFromIdea(outlineInput)
        );
      }

      const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
      return createAiOutlineService({
        registry: registry as {
          languageModel: (modelId: string) => unknown;
        },
        generateText: generateText as (payload: {
          model: unknown;
          prompt: string;
        }) => Promise<{ text: string }>,
      }).generateFromIdea(outlineInput);
    },
  };

  const chapterWriter = {
    async writeChapter(chapterInput: {
      modelId: string;
      prompt: string;
      onChunk?: (chunk: string) => void;
    }) {
      const persistedConfigs = modelConfigs.list();
      const runtimeMode = getRuntimeModelMode(persistedConfigs);
      if (runtimeMode.kind === 'mock') {
        return withMockRuntimeDelay(async () => {
          const result = await mockServices.chapterWriter.writeChapter(chapterInput);

          if (chapterInput.onChunk) {
            await streamMockChapterContent(result.content, chapterInput.onChunk);
          }

          return result;
        });
      }

      const model = getRuntimeLanguageModel({
        persistedConfigs,
        modelId: chapterInput.modelId,
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
        prompt: chapterInput.prompt,
        onChunk: chapterInput.onChunk,
      });
    },
  };

  function createRegistryBackedService<T>(
    factory: (deps: {
      registry: { languageModel: (id: string) => unknown };
      generateText: (payload: {
        model: unknown;
        prompt: string;
      }) => Promise<{ text: string }>;
    }) => T
  ) {
    const runtimeMode = getRuntimeModelMode(modelConfigs.list());
    if (runtimeMode.kind === 'mock') {
      return null;
    }

    const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
    return factory({
      registry: registry as { languageModel: (id: string) => unknown },
      generateText: generateText as (payload: {
        model: unknown;
        prompt: string;
      }) => Promise<{ text: string }>,
    });
  }

  const summaryGenerator = {
    async summarizeChapter(summaryInput: { modelId: string; content: string }) {
      const service = createRegistryBackedService(createAiSummaryGenerator);
      if (!service) {
        return mockServices.summaryGenerator.summarizeChapter(summaryInput);
      }

      return service.summarizeChapter(summaryInput);
    },
  };

  const plotThreadExtractor = {
    async extractThreads(extractInput: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const service = createRegistryBackedService(createAiPlotThreadExtractor);
      if (!service) {
        return mockServices.plotThreadExtractor.extractThreads(extractInput);
      }

      return service.extractThreads(extractInput);
    },
  };

  const characterStateExtractor = {
    async extractStates(extractInput: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const service = createRegistryBackedService(createAiCharacterStateExtractor);
      if (!service) {
        return mockServices.characterStateExtractor.extractStates(extractInput);
      }

      return service.extractStates(extractInput);
    },
  };

  const sceneRecordExtractor = {
    async extractScene(extractInput: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const service = createRegistryBackedService(createAiSceneRecordExtractor);
      if (!service) {
        return mockServices.sceneRecordExtractor.extractScene(extractInput);
      }

      return service.extractScene(extractInput);
    },
  };

  const chapterUpdateExtractor = {
    async extractChapterUpdate(extractInput: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      const service = createRegistryBackedService(createAiChapterUpdateExtractor);
      if (!service) {
        return mockServices.chapterUpdateExtractor.extractChapterUpdate(
          extractInput
        );
      }

      return service.extractChapterUpdate(extractInput);
    },
  };

  const chapterAuditor = {
    async auditChapter(auditInput: {
      modelId: string;
      draft: string;
      auditContext: string;
    }) {
      const service = createRegistryBackedService(createAiChapterAuditor);
      if (!service) {
        return mockServices.chapterAuditor.auditChapter(auditInput);
      }

      return service.auditChapter(auditInput);
    },
  };

  const chapterRevision = {
    async reviseChapter(revisionInput: {
      modelId: string;
      originalPrompt: string;
      draft: string;
      issues: NarrativeAudit['issues'];
    }) {
      const service = createRegistryBackedService(createAiChapterRevision);
      if (!service) {
        return mockServices.chapterRevision.reviseChapter(revisionInput);
      }

      return service.reviseChapter(revisionInput);
    },
  };

  const narrativeStateExtractor = {
    async extractState(stateInput: { modelId: string; content: string }) {
      const service = createRegistryBackedService(createAiNarrativeStateExtractor);
      if (!service) {
        return mockServices.narrativeStateExtractor.extractState(stateInput);
      }

      return service.extractState(stateInput);
    },
  };

  const narrativeCheckpoint = {
    async reviewCheckpoint(checkpointInput: {
      bookId: string;
      chapterIndex: number;
    }) {
      const runtimeMode = getRuntimeModelMode(modelConfigs.list());
      if (runtimeMode.kind === 'mock') {
        return mockServices.narrativeCheckpoint.reviewCheckpoint(checkpointInput);
      }

      return {
        checkpointType: 'arc',
        arcReport: {},
        threadDebt: {},
        pacingReport: {},
        replanningNotes: null,
      };
    },
  };

  return {
    outlineService,
    chapterWriter,
    summaryGenerator,
    plotThreadExtractor,
    characterStateExtractor,
    sceneRecordExtractor,
    chapterUpdateExtractor,
    chapterAuditor,
    chapterRevision,
    narrativeStateExtractor,
    narrativeCheckpoint,
    resolveModelId: () => {
      const runtimeMode = getRuntimeModelMode(modelConfigs.list());
      return runtimeMode.resolveModelId();
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
        generateText: generateText as (payload: {
          model: unknown;
          prompt: string;
        }) => Promise<{ text: string }>,
      }).testModel(modelId);
    },
  };
}
