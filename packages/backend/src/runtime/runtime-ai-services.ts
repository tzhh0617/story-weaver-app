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
} from '../core/ai-post-chapter.js';
import { createAiOutlineService } from '../core/ai-outline.js';
import { createChapterWriter } from '../core/chapter-writer.js';
import { createModelTestService } from '../core/model-test.js';
import type { NarrativeAudit } from '../core/narrative/types.js';
import type { OutlineGenerationInput } from '../core/types.js';
import {
  normalizeModelId,
  type ModelConfigInput,
} from '../models/config.js';
import {
  resolveEnvironmentModelConfigs,
} from '../models/environment-config.js';
import { createRuntimeRegistry } from '../models/registry.js';
import {
  createRuntimeMode,
} from '../models/runtime-mode.js';

function getRuntimeModelMode(persistedConfigs: ModelConfigInput[]) {
  const environmentConfigs = resolveEnvironmentModelConfigs();

  return createRuntimeMode({
    persistedConfigs,
    environmentConfigs: environmentConfigs.configs,
    preferEnvironmentConfigs: environmentConfigs.preferEnvironmentConfigs,
  });
}

function getRuntimeLanguageModel(input: {
  persistedConfigs: ModelConfigInput[];
  modelId: string;
}) {
  const runtimeMode = getRuntimeModelMode(input.persistedConfigs);
  const modelId = normalizeModelId(input.modelId);

  if (!runtimeMode.availableConfigs.some((config) => config.id === modelId)) {
    throw new Error(`Model not found: ${modelId}`);
  }

  const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
  return (registry as { languageModel: (id: string) => unknown }).languageModel(
    modelId
  );
}

export function createRuntimeAiServices(input: {
  modelConfigs: {
    list: () => ModelConfigInput[];
  };
}) {
  const { modelConfigs } = input;

  const outlineService = {
    async generateTitleFromIdea(
      outlineInput: OutlineGenerationInput & { modelId: string }
    ) {
      const runtimeMode = getRuntimeModelMode(modelConfigs.list());
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
      return service.reviseChapter(revisionInput);
    },
  };

  const narrativeStateExtractor = {
    async extractState(stateInput: { modelId: string; content: string }) {
      const service = createRegistryBackedService(createAiNarrativeStateExtractor);
      return service.extractState(stateInput);
    },
  };

  const narrativeCheckpoint = {
    async reviewCheckpoint(checkpointInput: {
      bookId: string;
      chapterIndex: number;
    }) {
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
      const normalizedModelId = normalizeModelId(modelId);
      const runtimeMode = getRuntimeModelMode(modelConfigs.list());

      if (
        !runtimeMode.availableConfigs.some((config) => config.id === normalizedModelId)
      ) {
        return {
          ok: false,
          latency: 0,
          error: `Model not found: ${normalizedModelId}`,
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
      }).testModel(normalizedModelId);
    },
  };
}
