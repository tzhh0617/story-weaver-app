import type { BookRecord } from '@story-weaver/shared/contracts';
import { createBookAggregate } from './aggregates/book/index.js';
import { createOutlineAggregate } from './aggregates/outline/index.js';
import { createChapterAggregate } from './aggregates/chapter/index.js';
export type { BookOrchestratorDeps } from './orchestration/orchestrator-deps.js';
import type { BookOrchestratorDeps } from './orchestration/orchestrator-deps.js';

export function createBookOrchestrator(deps: BookOrchestratorDeps) {
  const resolveModelId =
    deps.resolveModelId ??
    (() => {
      throw new Error('No model configured');
    });

  const bookAggregate = createBookAggregate({
    books: deps.books,
    chapters: deps.chapters,
    sceneRecords: {
      getLatestByBook: deps.sceneRecords.getLatestByBook,
      clearByBook: deps.sceneRecords.clearByBook,
    },
    characters: {
      listLatestStatesByBook: deps.characters.listLatestStatesByBook,
      clearStatesByBook: deps.characters.clearStatesByBook,
      deleteByBook: deps.characters.deleteByBook,
    },
    plotThreads: {
      listByBook: deps.plotThreads.listByBook,
      clearByBook: deps.plotThreads.clearByBook,
    },
    storyBibles: deps.storyBibles,
    characterArcs: deps.characterArcs,
    relationshipEdges: deps.relationshipEdges,
    worldRules: deps.worldRules,
    narrativeThreads: deps.narrativeThreads,
    volumePlans: deps.volumePlans,
    chapterCards: deps.chapterCards,
    chapterTensionBudgets: deps.chapterTensionBudgets,
    chapterAudits: deps.chapterAudits,
    narrativeCheckpoints: deps.narrativeCheckpoints,
    progress: deps.progress,
    onBookUpdated: deps.onBookUpdated,
  });

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
      title?: string;
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
      modelId?: string;
      viralStrategy?: BookRecord['viralStrategy'];
    }) {
      return bookAggregate.createBook(input);
    },

    listBooks() {
      return bookAggregate.listBooks();
    },

    getBookDetail(bookId: string) {
      return bookAggregate.getBookDetail(bookId);
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
      bookAggregate.pauseBook(bookId);
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
      bookAggregate.deleteBook(bookId);
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
