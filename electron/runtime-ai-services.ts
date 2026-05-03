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
import type { ExecutionLogDebugContext } from '../src/shared/contracts.js';

const MOCK_STREAM_CHUNK_TOKENS = 40;

type RuntimeAiDebugLog = {
  level: 'debug' | 'error';
  eventType: string;
  phase?: string | null;
  message: string;
  errorMessage?: string | null;
  errorStack?: string | null;
  durationMs?: number | null;
  debugContext?: ExecutionLogDebugContext | null;
};

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

function getModelConfig(): ModelConfigInput | null {
  return runtimeConfig.modelConfig;
}

function getRuntimeModelMode(persistedConfigs: ModelConfigInput[]) {
  const modelConfig = getModelConfig();
  return createRuntimeMode({
    persistedConfigs,
    environmentConfigs: modelConfig ? [modelConfig] : [],
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
  onDebugLog?: (entry: RuntimeAiDebugLog) => void;
}) {
  const { modelConfigs, onDebugLog } = input;
  const mockServices = createMockStoryServices();

  function emitDebugLog(entry: RuntimeAiDebugLog) {
    onDebugLog?.(entry);
  }

  function summarizeTextLength(value: string | undefined) {
    return value ? value.length : 0;
  }

  function safeArrayLength(value: unknown) {
    return Array.isArray(value) ? value.length : 0;
  }

  async function withLoggedOperation<T>(input: {
    operation: string;
    phase?: string | null;
    message: string;
    debugContext?: ExecutionLogDebugContext | null;
    run: () => Promise<T>;
    summarizeResult?: (result: T) => ExecutionLogDebugContext | null;
  }) {
    const startedAt = Date.now();
    emitDebugLog({
      level: 'debug',
      eventType: 'ai_operation_started',
      phase: input.phase ?? null,
      message: input.message,
      debugContext: {
        operation: input.operation,
        ...(input.debugContext ?? {}),
      },
    });

    try {
      const result = await input.run();
      emitDebugLog({
        level: 'debug',
        eventType: 'ai_operation_completed',
        phase: input.phase ?? null,
        message: `${input.message}完成`,
        durationMs: Date.now() - startedAt,
        debugContext: {
          operation: input.operation,
          ...(input.debugContext ?? {}),
          ...(input.summarizeResult?.(result) ?? {}),
        },
      });
      return result;
    } catch (error) {
      emitDebugLog({
        level: 'error',
        eventType: 'ai_operation_failed',
        phase: input.phase ?? null,
        message: `${input.message}失败`,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack ?? null : null,
        durationMs: Date.now() - startedAt,
        debugContext: {
          operation: input.operation,
          ...(input.debugContext ?? {}),
        },
      });
      throw error;
    }
  }

  function getResolvedRuntimeMode() {
    const persistedConfigs = modelConfigs.list();
    const runtimeMode = getRuntimeModelMode(persistedConfigs);
    emitDebugLog({
      level: 'debug',
      eventType: 'runtime_mode_resolved',
      message: `运行模式已解析为 ${runtimeMode.kind}`,
      debugContext: {
        runtimeMode: runtimeMode.kind,
        persistedConfigCount: persistedConfigs.length,
        availableConfigIds:
          runtimeMode.kind === 'mock'
            ? []
            : runtimeMode.availableConfigs.map((config) => config.id),
      },
    });

    return { persistedConfigs, runtimeMode };
  }

  const outlineService = {
    async generateTitleFromIdea(
      outlineInput: OutlineGenerationInput & { modelId: string }
    ) {
      return withLoggedOperation({
        operation: 'outline.generateTitleFromIdea',
        phase: 'naming_title',
        message: '开始生成书名',
        debugContext: {
          modelId: outlineInput.modelId,
          ideaLength: summarizeTextLength(outlineInput.idea),
        },
        summarizeResult: (result) => ({
          titleLength: summarizeTextLength(result),
        }),
        run: async () => {
          const { runtimeMode } = getResolvedRuntimeMode();
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
      });
    },

    async generateFromIdea(
      outlineInput: OutlineGenerationInput & { modelId: string }
    ) {
      return withLoggedOperation({
        operation: 'outline.generateFromIdea',
        phase: 'building_outline',
        message: '开始生成故事规划',
        debugContext: {
          modelId: outlineInput.modelId,
          ideaLength: summarizeTextLength(outlineInput.idea),
          targetChapters: outlineInput.targetChapters,
          wordsPerChapter: outlineInput.wordsPerChapter,
        },
        summarizeResult: (result) => ({
          worldSettingLength: summarizeTextLength(result.worldSetting),
          masterOutlineLength: summarizeTextLength(result.masterOutline),
          volumeOutlineCount: result.volumeOutlines.length,
          chapterOutlineCount: result.chapterOutlines.length,
        }),
        run: async () => {
          const { runtimeMode } = getResolvedRuntimeMode();
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
      });
    },
  };

  const chapterWriter = {
    async writeChapter(chapterInput: {
      modelId: string;
      prompt: string;
      onChunk?: (chunk: string) => void;
    }) {
      return withLoggedOperation({
        operation: 'chapterWriter.writeChapter',
        phase: 'writing',
        message: '开始生成章节正文',
        debugContext: {
          modelId: chapterInput.modelId,
          promptLength: summarizeTextLength(chapterInput.prompt),
          streamingEnabled: Boolean(chapterInput.onChunk),
        },
        summarizeResult: (result) => ({
          contentLength: summarizeTextLength(result.content),
          usage: result.usage ?? null,
        }),
        run: async () => {
          const { persistedConfigs, runtimeMode } = getResolvedRuntimeMode();
          if (runtimeMode.kind === 'mock') {
            return withMockRuntimeDelay(async () => {
              const result = await mockServices.chapterWriter.writeChapter(
                chapterInput
              );

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
      return withLoggedOperation({
        operation: 'summaryGenerator.summarizeChapter',
        message: '开始提炼章节摘要',
        debugContext: {
          modelId: summaryInput.modelId,
          contentLength: summarizeTextLength(summaryInput.content),
        },
        summarizeResult: (result) => ({
          summaryLength: summarizeTextLength(result),
        }),
        run: async () => {
          const service = createRegistryBackedService(createAiSummaryGenerator);
          if (!service) {
            return mockServices.summaryGenerator.summarizeChapter(summaryInput);
          }

          return service.summarizeChapter(summaryInput);
        },
      });
    },
  };

  const plotThreadExtractor = {
    async extractThreads(extractInput: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      return withLoggedOperation({
        operation: 'plotThreadExtractor.extractThreads',
        message: '开始提取情节线程',
        debugContext: {
          modelId: extractInput.modelId,
          chapterIndex: extractInput.chapterIndex,
          contentLength: summarizeTextLength(extractInput.content),
        },
        summarizeResult: (result) => ({
          openedThreadCount: result.openedThreads.length,
          resolvedThreadCount: result.resolvedThreadIds.length,
        }),
        run: async () => {
          const service = createRegistryBackedService(createAiPlotThreadExtractor);
          if (!service) {
            return mockServices.plotThreadExtractor.extractThreads(extractInput);
          }

          return service.extractThreads(extractInput);
        },
      });
    },
  };

  const characterStateExtractor = {
    async extractStates(extractInput: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      return withLoggedOperation({
        operation: 'characterStateExtractor.extractStates',
        message: '开始提取角色状态',
        debugContext: {
          modelId: extractInput.modelId,
          chapterIndex: extractInput.chapterIndex,
          contentLength: summarizeTextLength(extractInput.content),
        },
        summarizeResult: (result) => ({
          characterStateCount: result.length,
        }),
        run: async () => {
          const service = createRegistryBackedService(
            createAiCharacterStateExtractor
          );
          if (!service) {
            return mockServices.characterStateExtractor.extractStates(extractInput);
          }

          return service.extractStates(extractInput);
        },
      });
    },
  };

  const sceneRecordExtractor = {
    async extractScene(extractInput: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      return withLoggedOperation({
        operation: 'sceneRecordExtractor.extractScene',
        message: '开始提取场景记录',
        debugContext: {
          modelId: extractInput.modelId,
          chapterIndex: extractInput.chapterIndex,
          contentLength: summarizeTextLength(extractInput.content),
        },
        summarizeResult: (result) => ({
          hasScene: Boolean(result),
          locationLength: result ? summarizeTextLength(result.location) : 0,
        }),
        run: async () => {
          const service = createRegistryBackedService(createAiSceneRecordExtractor);
          if (!service) {
            return mockServices.sceneRecordExtractor.extractScene(extractInput);
          }

          return service.extractScene(extractInput);
        },
      });
    },
  };

  const chapterUpdateExtractor = {
    async extractChapterUpdate(extractInput: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) {
      return withLoggedOperation({
        operation: 'chapterUpdateExtractor.extractChapterUpdate',
        message: '开始提取章节更新',
        debugContext: {
          modelId: extractInput.modelId,
          chapterIndex: extractInput.chapterIndex,
          contentLength: summarizeTextLength(extractInput.content),
        },
        summarizeResult: (result) => ({
          summaryLength: summarizeTextLength(result.summary),
          characterStateCount: result.characterStates.length,
          openedThreadCount: result.openedThreads.length,
          resolvedThreadCount: result.resolvedThreadIds.length,
          hasScene: Boolean(result.scene),
        }),
        run: async () => {
          const service = createRegistryBackedService(createAiChapterUpdateExtractor);
          if (!service) {
            return mockServices.chapterUpdateExtractor.extractChapterUpdate(
              extractInput
            );
          }

          return service.extractChapterUpdate(extractInput);
        },
      });
    },
  };

  const chapterAuditor = {
    async auditChapter(auditInput: {
      modelId: string;
      draft: string;
      auditContext: string;
    }) {
      return withLoggedOperation({
        operation: 'chapterAuditor.auditChapter',
        phase: 'auditing_chapter',
        message: '开始审校章节',
        debugContext: {
          modelId: auditInput.modelId,
          draftLength: summarizeTextLength(auditInput.draft),
          auditContextLength: summarizeTextLength(auditInput.auditContext),
        },
        summarizeResult: (result) => ({
          issueCount: result.issues.length,
          overallScore: result.score,
        }),
        run: async () => {
          const service = createRegistryBackedService(createAiChapterAuditor);
          if (!service) {
            return mockServices.chapterAuditor.auditChapter(auditInput);
          }

          return service.auditChapter(auditInput);
        },
      });
    },
  };

  const chapterRevision = {
    async reviseChapter(revisionInput: {
      modelId: string;
      originalPrompt: string;
      draft: string;
      issues: NarrativeAudit['issues'];
    }) {
      return withLoggedOperation({
        operation: 'chapterRevision.reviseChapter',
        phase: 'revising_chapter',
        message: '开始修订章节',
        debugContext: {
          modelId: revisionInput.modelId,
          originalPromptLength: summarizeTextLength(revisionInput.originalPrompt),
          draftLength: summarizeTextLength(revisionInput.draft),
          issueCount: revisionInput.issues.length,
        },
        summarizeResult: (result) => ({
          contentLength: summarizeTextLength(result),
        }),
        run: async () => {
          const service = createRegistryBackedService(createAiChapterRevision);
          if (!service) {
            return mockServices.chapterRevision.reviseChapter(revisionInput);
          }

          return service.reviseChapter(revisionInput);
        },
      });
    },
  };

  const narrativeStateExtractor = {
    async extractState(stateInput: { modelId: string; content: string }) {
      return withLoggedOperation({
        operation: 'narrativeStateExtractor.extractState',
        message: '开始提取叙事状态',
        debugContext: {
          modelId: stateInput.modelId,
          contentLength: summarizeTextLength(stateInput.content),
        },
        summarizeResult: (result) => ({
          characterStateCount: result.characterStates.length,
          relationshipStateCount: result.relationshipStates.length,
          threadUpdateCount: result.threadUpdates.length,
          hasScene: Boolean(result.scene),
          themeProgressionLength: summarizeTextLength(result.themeProgression),
        }),
        run: async () => {
          const service = createRegistryBackedService(
            createAiNarrativeStateExtractor
          );
          if (!service) {
            return mockServices.narrativeStateExtractor.extractState(stateInput);
          }

          return service.extractState(stateInput);
        },
      });
    },
  };

  const narrativeCheckpoint = {
    async reviewCheckpoint(checkpointInput: {
      bookId: string;
      chapterIndex: number;
    }) {
      return withLoggedOperation({
        operation: 'narrativeCheckpoint.reviewCheckpoint',
        phase: 'checkpoint_review',
        message: '开始复盘叙事检查点',
        debugContext: checkpointInput,
        summarizeResult: (result) => ({
          checkpointType: result.checkpointType,
          hasReplanningNotes: Boolean(result.replanningNotes),
        }),
        run: async () => {
          const { runtimeMode } = getResolvedRuntimeMode();
          if (runtimeMode.kind === 'mock') {
            return mockServices.narrativeCheckpoint.reviewCheckpoint(
              checkpointInput
            );
          }

          return {
            checkpointType: 'arc',
            arcReport: {},
            threadDebt: {},
            pacingReport: {},
            replanningNotes: null,
          };
        },
      });
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
      const { runtimeMode } = getResolvedRuntimeMode();
      return runtimeMode.resolveModelId();
    },
    testModel: async (modelId: string) => {
      return withLoggedOperation({
        operation: 'modelTest.testModel',
        message: '开始测试模型连通性',
        debugContext: {
          modelId,
        },
        summarizeResult: (result) => result,
        run: async () => {
          const { runtimeMode } = getResolvedRuntimeMode();

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
      });
    },
  };
}
