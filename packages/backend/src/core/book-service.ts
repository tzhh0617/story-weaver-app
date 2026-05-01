import type {
  BookGenerationEvent,
  BookRecord,
  BookStatus,
} from '@story-weaver/shared/contracts';
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
} from './narrative/types.js';
import type { OutlineBundle, OutlineGenerationInput } from './types.js';
import { createBookAggregate } from './aggregates/book/index.js';
import { createOutlineAggregate } from './aggregates/outline/index.js';
import { createChapterAggregate } from './aggregates/chapter/index.js';
import type { ChapterUpdate } from './aggregates/chapter/chapter-aggregate.js';

export function createBookService(deps: {
  books: {
    create: (input: {
      id: string;
      title: string;
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
      viralStrategy?: BookRecord['viralStrategy'];
    }) => void;
    list: () => Array<{
      id: string;
      title: string;
      idea: string;
      status: string;
      targetChapters: number;
      wordsPerChapter: number;
      viralStrategy?: BookRecord['viralStrategy'];
      createdAt: string;
      updatedAt: string;
    }>;
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
    updateTitle: (bookId: string, title: string) => void;
    delete: (bookId: string) => void;
    saveContext: (input: {
      bookId: string;
      worldSetting: string;
      outline: string;
      styleGuide?: string | null;
    }) => void;
    getContext: (bookId: string) =>
      | {
          bookId: string;
          worldSetting: string;
          outline: string;
          styleGuide: string | null;
        }
      | undefined;
    clearGeneratedState?: (bookId: string) => void;
  };
  chapters: {
    upsertOutline: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string;
      outline: string;
    }) => void;
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
    listProgressByBookIds?: (
      bookIds: string[]
    ) => Map<string, { completedChapters: number; totalChapters: number }>;
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
    clearGeneratedContent: (bookId: string) => void;
    deleteByBook: (bookId: string) => void;
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
    clearByBook: (bookId: string) => void;
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
    clearStatesByBook: (bookId: string) => void;
    deleteByBook: (bookId: string) => void;
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
    clearByBook: (bookId: string) => void;
  };
  storyBibles?: {
    saveGraph: (
      bookId: string,
      bible: NonNullable<OutlineBundle['narrativeBible']>
    ) => void;
    getByBook?: (bookId: string) =>
      | Omit<
          NonNullable<OutlineBundle['narrativeBible']>,
          'characterArcs' | 'relationshipEdges' | 'worldRules' | 'narrativeThreads'
        >
      | null;
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
  worldRules?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['worldRules'];
  };
  narrativeThreads?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'];
    resolveThread?: (bookId: string, threadId: string, resolvedAt: number) => void;
    upsertThread?: (
      bookId: string,
      thread: NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'][number]
    ) => void;
  };
  volumePlans?: {
    upsertMany: (bookId: string, plans: NonNullable<OutlineBundle['volumePlans']>) => void;
    listByBook?: (bookId: string) => NonNullable<OutlineBundle['volumePlans']>;
  };
  chapterCards?: {
    upsertMany: (cards: NonNullable<OutlineBundle['chapterCards']>) => void;
    getNextUnwritten?: (bookId: string) => ChapterCard | null;
    listByBook?: (bookId: string) => ChapterCard[];
    upsertThreadActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterThreadAction[]
    ) => void;
    listThreadActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterThreadAction[];
    upsertCharacterPressures?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      pressures: ChapterCharacterPressure[]
    ) => void;
    listCharacterPressures?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterCharacterPressure[];
    upsertRelationshipActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterRelationshipAction[]
    ) => void;
    listRelationshipActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterRelationshipAction[];
  };
  chapterTensionBudgets?: {
    upsertMany: (budgets: ChapterTensionBudget[]) => void;
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
  relationshipStates?: {
    save: (input: RelationshipStateInput) => void;
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
    getByBookId: (bookId: string) =>
      | {
          bookId: string;
          currentVolume: number | null;
          currentChapter: number | null;
          phase: string | null;
          stepLabel: string | null;
          retryCount: number;
          errorMsg: string | null;
        }
      | undefined;
    reset: (bookId: string, phase: string) => void;
    deleteByBook: (bookId: string) => void;
  };
  outlineService: {
    generateTitleFromIdea?: (
      input: OutlineGenerationInput & { modelId: string }
    ) => Promise<string>;
    generateFromIdea: (
      input: OutlineGenerationInput & { modelId: string }
    ) => Promise<OutlineBundle>;
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
  narrativeStateExtractor?: {
    extractState: (input: {
      modelId: string;
      content: string;
    }) => Promise<NarrativeStateDelta>;
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
    }) => Promise<ChapterUpdate>;
  };
  shouldRewriteShortChapter?: (input: {
    content: string;
    wordsPerChapter: number;
  }) => boolean;
  resolveModelId?: () => string;
  onBookUpdated?: (bookId: string) => void;
  onGenerationEvent?: (event: BookGenerationEvent) => void;
}) {
  const resolveModelId =
    deps.resolveModelId ??
    (() => {
      throw new Error('No model configured');
    });

  const aggregate = createBookAggregate(deps);
  const outlineAggregate = createOutlineAggregate({
    books: {
      getById: deps.books.getById,
      updateStatus: deps.books.updateStatus,
      updateTitle: deps.books.updateTitle,
      saveContext: deps.books.saveContext,
      getContext: deps.books.getContext,
    },
    chapters: deps.chapters,
    progress: deps.progress,
    outlineService: deps.outlineService,
    storyBibles: deps.storyBibles,
    volumePlans: deps.volumePlans,
    chapterCards: deps.chapterCards,
    chapterTensionBudgets: deps.chapterTensionBudgets,
    resolveModelId,
    onBookUpdated: deps.onBookUpdated,
    onGenerationEvent: deps.onGenerationEvent,
  });
  const chapterAggregate = createChapterAggregate({
    books: {
      getById: deps.books.getById,
      updateStatus: deps.books.updateStatus,
      getContext: deps.books.getContext,
    },
    chapters: {
      listByBook: deps.chapters.listByBook,
      saveContent: deps.chapters.saveContent,
    },
    progress: deps.progress,
    sceneRecords: {
      save: deps.sceneRecords.save,
      getLatestByBook: deps.sceneRecords.getLatestByBook,
    },
    characters: {
      saveState: deps.characters.saveState,
      listLatestStatesByBook: deps.characters.listLatestStatesByBook,
    },
    plotThreads: deps.plotThreads,
    chapterWriter: deps.chapterWriter,
    chapterAuditor: deps.chapterAuditor,
    chapterRevision: deps.chapterRevision,
    summaryGenerator: deps.summaryGenerator,
    plotThreadExtractor: deps.plotThreadExtractor,
    characterStateExtractor: deps.characterStateExtractor,
    sceneRecordExtractor: deps.sceneRecordExtractor,
    chapterUpdateExtractor: deps.chapterUpdateExtractor,
    storyBibles: deps.storyBibles,
    chapterCards: deps.chapterCards,
    chapterTensionBudgets: deps.chapterTensionBudgets,
    chapterAudits: deps.chapterAudits,
    worldRules: deps.worldRules,
    characterArcs: deps.characterArcs,
    relationshipEdges: deps.relationshipEdges,
    relationshipStates: deps.relationshipStates,
    narrativeThreads: deps.narrativeThreads,
    narrativeStateExtractor: deps.narrativeStateExtractor,
    narrativeCheckpoint: deps.narrativeCheckpoint,
    narrativeCheckpoints: deps.narrativeCheckpoints,
    shouldRewriteShortChapter: deps.shouldRewriteShortChapter,
    resolveModelId,
    onBookUpdated: deps.onBookUpdated,
    onGenerationEvent: deps.onGenerationEvent,
  });

  return {
    createBook(input: {
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
      modelId?: string;
      viralStrategy?: BookRecord['viralStrategy'];
    }) {
      return aggregate.createBook(input);
    },

    listBooks() {
      return aggregate.listBooks();
    },

    getBookDetail(bookId: string) {
      return aggregate.getBookDetail(bookId);
    },

    async startBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'building_world');
      await outlineAggregate.generateFromIdea(bookId);
    },

    pauseBook(bookId: string) {
      aggregate.pauseBook(bookId);
    },

    async resumeBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'writing');
      deps.progress.updatePhase(bookId, 'writing');

      return this.writeRemainingChapters(bookId);
    },

    async writeNextChapter(bookId: string) {
      return chapterAggregate.writeNext(bookId);
    },

    async writeRemainingChapters(bookId: string) {
      let completedChapters = 0;

      while (true) {
        const currentBook = deps.books.getById(bookId);
        if (!currentBook) {
          return {
            completedChapters,
            status: 'deleted' as const,
          };
        }

        if (currentBook.status === 'paused') {
          return {
            completedChapters,
            status: 'paused' as const,
          };
        }

        const nextChapter = deps.chapters
          .listByBook(bookId)
          .find((chapter) => !chapter.content);

        if (!nextChapter) {
          break;
        }

        const result = await this.writeNextChapter(bookId);
        if (!deps.books.getById(bookId)) {
          return {
            completedChapters,
            status: 'deleted' as const,
          };
        }

        if ('deleted' in result && result.deleted) {
          return {
            completedChapters,
            status: 'deleted' as const,
          };
        }
        if ('paused' in result && result.paused) {
          return {
            completedChapters,
            status: 'paused' as const,
          };
        }

        completedChapters += 1;
      }

      if (!deps.books.getById(bookId)) {
        return {
          completedChapters,
          status: 'deleted' as const,
        };
      }

      deps.books.updateStatus(bookId, 'completed');
      deps.progress.updatePhase(bookId, 'completed');
      deps.onBookUpdated?.(bookId);

      return {
        completedChapters,
        status: 'completed' as const,
      };
    },

    deleteBook(bookId: string) {
      aggregate.deleteBook(bookId);
    },

    async restartBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.clearGeneratedState?.(bookId);
      deps.chapters.deleteByBook(bookId);
      deps.plotThreads.clearByBook(bookId);
      deps.characters.clearStatesByBook(bookId);
      deps.sceneRecords.clearByBook(bookId);
      deps.books.updateStatus(bookId, 'creating');
      deps.progress.reset(bookId, 'creating');
      deps.onBookUpdated?.(bookId);

      await this.startBook(bookId);

      if (!deps.books.getById(bookId)) {
        return {
          completedChapters: 0,
          status: 'deleted' as const,
        };
      }

      deps.books.updateStatus(bookId, 'writing');
      deps.progress.updatePhase(bookId, 'writing');
      deps.onBookUpdated?.(bookId);

      return this.writeRemainingChapters(bookId);
    },
  };
}
