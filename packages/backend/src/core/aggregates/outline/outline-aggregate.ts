import type { BookGenerationEvent, BookStatus } from '@story-weaver/shared/contracts';
import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
} from '../../narrative/types.js';
import { normalizeChapterOutlinesToTarget } from '../../story-constraints.js';
import type { OutlineBundle, OutlineGenerationInput } from '../../types.js';
import { deriveTitleFromIdea } from '../book/book-state.js';

export type OutlineAggregateDeps = {
  books: {
    getById: (bookId: string) =>
      | {
          id: string;
          title: string;
          idea: string;
          status: string;
          targetChapters: number;
          wordsPerChapter: number;
          viralStrategy?: unknown;
          createdAt: string;
          updatedAt: string;
        }
      | undefined;
    updateStatus: (bookId: string, status: BookStatus) => void;
    updateTitle: (bookId: string, title: string) => void;
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
  outlineService: {
    generateTitleFromIdea?: (
      input: OutlineGenerationInput & { modelId: string }
    ) => Promise<string>;
    generateFromIdea: (
      input: OutlineGenerationInput & { modelId: string }
    ) => Promise<OutlineBundle>;
  };
  storyBibles?: {
    saveGraph: (
      bookId: string,
      bible: NonNullable<OutlineBundle['narrativeBible']>
    ) => void;
  };
  volumePlans?: {
    upsertMany: (bookId: string, plans: NonNullable<OutlineBundle['volumePlans']>) => void;
  };
  chapterCards?: {
    upsertMany: (cards: NonNullable<OutlineBundle['chapterCards']>) => void;
    upsertThreadActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterThreadAction[]
    ) => void;
    upsertCharacterPressures?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      pressures: ChapterCharacterPressure[]
    ) => void;
    upsertRelationshipActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterRelationshipAction[]
    ) => void;
  };
  chapterTensionBudgets?: {
    upsertMany: (budgets: ChapterTensionBudget[]) => void;
  };
  resolveModelId: () => string;
  onBookUpdated?: (bookId: string) => void;
  onGenerationEvent?: (event: BookGenerationEvent) => void;
};

function saveChapterOutlines(
  deps: {
    chapters: {
      upsertOutline: (input: {
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        title: string;
        outline: string;
      }) => void;
    };
    onBookUpdated?: (bookId: string) => void;
  },
  bookId: string,
  chapterOutlines: OutlineBundle['chapterOutlines']
) {
  for (const chapter of chapterOutlines) {
    deps.chapters.upsertOutline({
      bookId,
      volumeIndex: chapter.volumeIndex,
      chapterIndex: chapter.chapterIndex,
      title: chapter.title,
      outline: chapter.outline,
    });
  }

  if (chapterOutlines.length) {
    deps.onBookUpdated?.(bookId);
  }
}

export function createOutlineAggregate(deps: OutlineAggregateDeps) {
  function emitProgress(input: {
    bookId: string;
    phase: string;
    stepLabel: string;
    currentVolume?: number | null;
    currentChapter?: number | null;
  }) {
    deps.onGenerationEvent?.({
      bookId: input.bookId,
      type: 'progress',
      phase: input.phase,
      stepLabel: input.stepLabel,
      currentVolume: input.currentVolume ?? null,
      currentChapter: input.currentChapter ?? null,
    });
  }

  function updateTrackedPhase(input: {
    bookId: string;
    phase: string;
    stepLabel: string;
    currentVolume?: number | null;
    currentChapter?: number | null;
    notifyBookUpdated?: boolean;
  }) {
    deps.progress.updatePhase(input.bookId, input.phase, {
      currentVolume: input.currentVolume ?? null,
      currentChapter: input.currentChapter ?? null,
      stepLabel: input.stepLabel,
    });
    emitProgress(input);
    if (input.notifyBookUpdated) {
      deps.onBookUpdated?.(input.bookId);
    }
  }

  return {
    async generateFromIdea(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      const modelId = deps.resolveModelId();

      // Phase 1: Title generation (optional)
      if (deps.outlineService.generateTitleFromIdea) {
        updateTrackedPhase({
          bookId,
          phase: 'naming_title',
          stepLabel: '正在生成书名',
          notifyBookUpdated: true,
        });

        const generatedTitle = (
          await deps.outlineService.generateTitleFromIdea({
            bookId,
            idea: book.idea,
            targetChapters: book.targetChapters,
            wordsPerChapter: book.wordsPerChapter,
            modelId,
          })
        ).trim();

        if (!deps.books.getById(bookId)) {
          return;
        }

        deps.books.updateTitle(
          bookId,
          generatedTitle || deriveTitleFromIdea(book.idea)
        );
        deps.onBookUpdated?.(bookId);
      }

      // Phase 2: World-building + outline generation
      updateTrackedPhase({
        bookId,
        phase: 'building_world',
        stepLabel: '正在构建世界观与叙事圣经',
        notifyBookUpdated: true,
      });

      const outlineBundle = await deps.outlineService.generateFromIdea({
        bookId,
        idea: book.idea,
        targetChapters: book.targetChapters,
        wordsPerChapter: book.wordsPerChapter,
        modelId,
        viralStrategy: (book as any).viralStrategy ?? null,
        onWorldSetting: (worldSetting) => {
          if (!deps.books.getById(bookId)) {
            return;
          }

          updateTrackedPhase({
            bookId,
            phase: 'building_outline',
            stepLabel: '正在生成故事大纲',
            notifyBookUpdated: true,
          });

          deps.books.saveContext({
            bookId,
            worldSetting,
            outline: '',
          });
          deps.onBookUpdated?.(bookId);
        },
        onMasterOutline: (masterOutline) => {
          const currentContext = deps.books.getContext(bookId);
          if (!deps.books.getById(bookId) || !currentContext) {
            return;
          }

          updateTrackedPhase({
            bookId,
            phase: 'planning_chapters',
            stepLabel: '正在规划章节卡',
            notifyBookUpdated: true,
          });

          deps.books.saveContext({
            bookId,
            worldSetting: currentContext.worldSetting,
            outline: masterOutline,
          });
          deps.onBookUpdated?.(bookId);
        },
        onChapterOutlines: (chapterOutlines) => {
          if (!deps.books.getById(bookId)) {
            return;
          }

          saveChapterOutlines(deps, bookId, chapterOutlines);
        },
      });

      // Book was deleted during generation
      if (!deps.books.getById(bookId)) {
        return;
      }

      // Phase 3: Post-generation saves
      deps.books.saveContext({
        bookId,
        worldSetting: outlineBundle.worldSetting,
        outline: outlineBundle.masterOutline,
      });

      if (outlineBundle.narrativeBible) {
        deps.storyBibles?.saveGraph(bookId, outlineBundle.narrativeBible);
      }
      if (outlineBundle.volumePlans) {
        deps.volumePlans?.upsertMany(bookId, outlineBundle.volumePlans);
      }
      if (outlineBundle.chapterCards) {
        deps.chapterCards?.upsertMany(outlineBundle.chapterCards);
      }
      if (outlineBundle.chapterTensionBudgets?.length) {
        deps.chapterTensionBudgets?.upsertMany(outlineBundle.chapterTensionBudgets);
      }
      for (const card of outlineBundle.chapterCards ?? []) {
        const threadActions = (outlineBundle.chapterThreadActions ?? []).filter(
          (action) =>
            action.volumeIndex === card.volumeIndex &&
            action.chapterIndex === card.chapterIndex
        );
        const characterPressures = (
          outlineBundle.chapterCharacterPressures ?? []
        ).filter(
          (pressure) =>
            pressure.volumeIndex === card.volumeIndex &&
            pressure.chapterIndex === card.chapterIndex
        );
        const relationshipActions = (
          outlineBundle.chapterRelationshipActions ?? []
        ).filter(
          (action) =>
            action.volumeIndex === card.volumeIndex &&
            action.chapterIndex === card.chapterIndex
        );
        deps.chapterCards?.upsertThreadActions?.(
          bookId,
          card.volumeIndex,
          card.chapterIndex,
          threadActions
        );
        deps.chapterCards?.upsertCharacterPressures?.(
          bookId,
          card.volumeIndex,
          card.chapterIndex,
          characterPressures
        );
        deps.chapterCards?.upsertRelationshipActions?.(
          bookId,
          card.volumeIndex,
          card.chapterIndex,
          relationshipActions
        );
      }

      saveChapterOutlines(
        deps,
        bookId,
        normalizeChapterOutlinesToTarget(
          outlineBundle.chapterOutlines,
          book.targetChapters
        )
      );

      // Phase 4: Final status update
      deps.books.updateStatus(bookId, 'building_outline');
      deps.progress.updatePhase(bookId, 'building_outline');
    },
  };
}
