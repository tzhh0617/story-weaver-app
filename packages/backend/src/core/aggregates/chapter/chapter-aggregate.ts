import type { BookGenerationEvent, BookRecord, BookStatus } from '@story-weaver/shared/contracts';
import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
  NarrativeAudit,
  NarrativeStateDelta,
  RelationshipStateInput,
  ViralStoryProtocol,
} from '../../narrative/types.js';
import type { OutlineBundle } from '../../types.js';
import { createAuditReviser } from './audit-reviser.js';
import { createCheckpointRunner } from './checkpoint-runner.js';
import { createChapterDiscovery } from './chapter-discovery.js';
import { createContinuityPersister } from './continuity-persister.js';
import { createContextBuilder } from './context-builder.js';
import { createDraftWriter } from './draft-writer.js';
import { createNarrativeStateWriter } from './narrative-state-writer.js';

export type ChapterAggregateDeps = {
  books: {
    getById: (bookId: string) =>
      | {
          id: string;
          title: string;
          idea: string;
          status: string;
          targetChapters: number;
          wordsPerChapter: number;
          viralStrategy?: BookRecord['viralStrategy'];
          createdAt: string;
          updatedAt: string;
        }
      | undefined;
    updateStatus: (bookId: string, status: BookStatus) => void;
    getContext: (bookId: string) =>
      | {
          bookId: string;
          worldSetting: string;
          outline: string;
          styleGuide: string | null;
        }
      | undefined;
  };
  chapters: {
    listByBook: (bookId: string) => Array<{
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string | null;
      outline: string | null;
      content: string | null;
      summary: string | null;
      wordCount: number;
      auditScore?: number | null;
      draftAttempts?: number;
    }>;
    saveContent: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      content: string;
      summary?: string | null;
      wordCount: number;
      auditScore?: number | null;
      draftAttempts?: number;
    }) => void;
  };
  progress: {
    updatePhase: (
      bookId: string,
      phase: string,
      metadata?: {
        currentVolume?: number | null;
        currentChapter?: number | null;
        stepLabel?: string | null;
        errorMsg?: string | null;
      }
    ) => void;
  };
  sceneRecords: {
    save: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      location: string;
      timeInStory: string;
      charactersPresent: string[];
      events?: string | null;
    }) => void;
    getLatestByBook: (bookId: string) =>
      | {
          bookId: string;
          volumeIndex: number;
          chapterIndex: number;
          location: string;
          timeInStory: string;
          charactersPresent: string[];
          events: string | null;
        }
      | null;
  };
  characters: {
    saveState: (input: {
      bookId: string;
      characterId: string;
      characterName: string;
      volumeIndex: number;
      chapterIndex: number;
      location?: string | null;
      status?: string | null;
      knowledge?: string | null;
      emotion?: string | null;
      powerLevel?: string | null;
    }) => void;
    listLatestStatesByBook: (bookId: string) => Array<{
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
  };
  plotThreads: {
    upsertThread: (input: {
      id: string;
      bookId: string;
      description: string;
      plantedAt: number;
      expectedPayoff?: number | null;
      resolvedAt?: number | null;
      importance?: string | null;
    }) => void;
    resolveThread: (bookId: string, id: string, resolvedAt: number) => void;
    listByBook: (bookId: string) => Array<{
      id: string;
      bookId: string;
      description: string;
      plantedAt: number;
      expectedPayoff: number | null;
      resolvedAt: number | null;
      importance: string;
    }>;
  };
  chapterWriter: {
    writeChapter: (input: {
      modelId: string;
      prompt: string;
      onChunk?: (chunk: string) => void;
    }) => Promise<{
      content: string;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
      };
    }>;
  };
  chapterAuditor?: {
    auditChapter: (input: {
      modelId: string;
      draft: string;
      auditContext: string;
      routePlanText?: string | null;
      viralStoryProtocol?: ViralStoryProtocol | null;
      chapterIndex?: number | null;
    }) => Promise<NarrativeAudit>;
  };
  chapterRevision?: {
    reviseChapter: (input: {
      modelId: string;
      originalPrompt: string;
      draft: string;
      issues: NarrativeAudit['issues'];
    }) => Promise<string>;
  };
  summaryGenerator: {
    summarizeChapter: (input: {
      modelId: string;
      content: string;
    }) => Promise<string>;
  };
  plotThreadExtractor: {
    extractThreads: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<{
      openedThreads: Array<{
        id: string;
        description: string;
        plantedAt: number;
        expectedPayoff?: number | null;
        importance?: string | null;
      }>;
      resolvedThreadIds: string[];
    }>;
  };
  characterStateExtractor: {
    extractStates: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<
      Array<{
        characterId: string;
        characterName: string;
        location?: string | null;
        status?: string | null;
        knowledge?: string | null;
        emotion?: string | null;
        powerLevel?: string | null;
      }>
    >;
  };
  sceneRecordExtractor: {
    extractScene: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<{
      location: string;
      timeInStory: string;
      charactersPresent: string[];
      events?: string | null;
    } | null>;
  };
  chapterUpdateExtractor?: {
    extractChapterUpdate: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<import('./chapter-types.js').ChapterUpdate>;
  };
  storyBibles?: {
    getByBook?: (bookId: string) =>
      | Omit<
          NonNullable<OutlineBundle['narrativeBible']>,
          'characterArcs' | 'relationshipEdges' | 'worldRules' | 'narrativeThreads'
        >
      | null;
  };
  chapterCards?: {
    listByBook?: (bookId: string) => ChapterCard[];
    getNextUnwritten?: (bookId: string) => ChapterCard | null;
    listThreadActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterThreadAction[];
    listCharacterPressures?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterCharacterPressure[];
    listRelationshipActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterRelationshipAction[];
  };
  chapterTensionBudgets?: {
    getByChapter?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterTensionBudget | null;
    listByBook?: (bookId: string) => ChapterTensionBudget[];
  };
  chapterAudits?: {
    save: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      attempt: number;
      audit: NarrativeAudit;
    }) => void;
    listLatestByBook?: (bookId: string) => Array<{
      volumeIndex: number;
      chapterIndex: number;
      attempt: number;
      score?: number;
      decision?: NarrativeAudit['decision'];
      issues?: NarrativeAudit['issues'];
      scoring: NarrativeAudit['scoring'];
    }>;
  };
  worldRules?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['worldRules'];
  };
  characterArcs?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['characterArcs'];
    saveState?: (input: {
      bookId: string;
      characterId: string;
      characterName: string;
      volumeIndex: number;
      chapterIndex: number;
      location?: string | null;
      status?: string | null;
      knowledge?: string | null;
      emotion?: string | null;
      powerLevel?: string | null;
      arcPhase?: string | null;
    }) => void;
  };
  relationshipEdges?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['relationshipEdges'];
  };
  relationshipStates?: {
    save: (input: RelationshipStateInput) => void;
  };
  narrativeThreads?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'];
    upsertThread?: (
      bookId: string,
      thread: NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'][number]
    ) => void;
    resolveThread?: (bookId: string, threadId: string, resolvedAt: number) => void;
  };
  narrativeStateExtractor?: {
    extractState: (input: {
      modelId: string;
      content: string;
    }) => Promise<NarrativeStateDelta>;
  };
  narrativeCheckpoint?: {
    reviewCheckpoint: (input: {
      bookId: string;
      chapterIndex: number;
    }) => Promise<{
      checkpointType: string;
      arcReport: unknown;
      threadDebt: unknown;
      pacingReport: unknown;
      replanningNotes: string | null;
    }>;
  };
  narrativeCheckpoints?: {
    save: (input: {
      bookId: string;
      chapterIndex: number;
      report?: unknown;
      checkpointType?: string;
      arcReport?: unknown;
      threadDebt?: unknown;
      pacingReport?: unknown;
      replanningNotes?: string | null;
      futureCardRevisions?: unknown[];
    }) => void;
    listByBook?: (bookId: string) => Array<{
      bookId: string;
      chapterIndex: number;
      checkpointType?: string;
      report: unknown;
      futureCardRevisions: unknown[];
      createdAt: string;
    }>;
  };
  shouldRewriteShortChapter?: (input: {
    content: string;
    wordsPerChapter: number;
  }) => boolean;
  resolveModelId: () => string;
  onBookUpdated?: (bookId: string) => void;
  onGenerationEvent?: (event: BookGenerationEvent) => void;
};

export function createChapterAggregate(deps: ChapterAggregateDeps) {
  const discovery = createChapterDiscovery(deps);
  const contextBuilder = createContextBuilder(deps);
  const draftWriter = createDraftWriter(deps);
  const auditReviser = createAuditReviser(deps);
  const continuityPersister = createContinuityPersister(deps);
  const stateWriter = createNarrativeStateWriter(deps);
  const checkpointRunner = createCheckpointRunner(deps);

  async function writeNext(bookId: string) {
    const {
      book,
      context,
      chapters,
      nextChapter,
      chapterCard,
      outline: nextChapterOutline,
      title: nextChapterTitle,
    } = discovery.findNextChapter({ bookId });

    const {
      modelId,
      storyBible,
      effectiveChapterCard,
      legacyContinuityContext,
      commandContext,
      routePlanText,
      prompt,
    } = contextBuilder.buildWriteContext({
      bookId,
      book,
      context,
      chapters,
      nextChapter,
      nextChapterOutline,
      nextChapterTitle,
      chapterCard,
    });

    const draftResult = await draftWriter.writeDraft({
      bookId,
      modelId,
      prompt,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
      title: nextChapterTitle,
      wordsPerChapter: book.wordsPerChapter,
    });
    if (draftResult.deleted) {
      return {
        deleted: true as const,
      };
    }
    if (draftResult.paused) {
      return {
        paused: true as const,
      };
    }
    let result = draftResult.result;

    const { result: auditedResult, auditScore, draftAttempts } = await auditReviser.auditAndRevise({
      bookId,
      modelId,
      content: result.content,
      prompt,
      commandContext,
      legacyContinuityContext,
      routePlanText,
      storyBible,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
      effectiveChapterCard,
    });
    result = auditedResult;

    const continuityResult = await continuityPersister.extractAndSaveContinuity({
      bookId,
      modelId,
      content: result.content,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
      auditScore,
      draftAttempts,
    });
    if (continuityResult.deleted) {
      return {
        deleted: true as const,
      };
    }

    await stateWriter.extractNarrativeState({
      bookId,
      modelId,
      content: result.content,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
    });

    await checkpointRunner.runCheckpoint({
      bookId,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
    });

    const latestBook = deps.books.getById(bookId);
    if (!latestBook) {
      return {
        deleted: true as const,
      };
    }

    if (latestBook.status === 'paused') {
      deps.progress.updatePhase(bookId, 'paused');
      deps.onBookUpdated?.(bookId);
      return result;
    }

    deps.books.updateStatus(bookId, 'writing');
    deps.progress.updatePhase(bookId, 'writing', {
      currentVolume: nextChapter.volumeIndex,
      currentChapter: nextChapter.chapterIndex,
      stepLabel: `正在生成第 ${nextChapter.chapterIndex} 章摘要与连续性`,
    });
    deps.onGenerationEvent?.({
      bookId,
      type: 'chapter-complete',
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
      title: nextChapterTitle,
    });
    deps.onBookUpdated?.(bookId);

    return result;
  }

  return {
    writeNext,
  };
}
