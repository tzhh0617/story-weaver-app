import { deriveTitleFromIdea } from '../book/book-state.js';
import type { OutlineAggregateDeps } from './outline-aggregate-deps.js';
import { createOutlineProgressTracker } from './outline-aggregate-deps.js';
import { saveOutlineBundle } from './outline-bundle-saver.js';

export type { OutlineAggregateDeps } from './outline-aggregate-deps.js';

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
  chapterOutlines: import('../../types.js').OutlineBundle['chapterOutlines']
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
  const { updateTrackedPhase } = createOutlineProgressTracker({
    progress: deps.progress,
    onBookUpdated: deps.onBookUpdated,
    onGenerationEvent: deps.onGenerationEvent,
  });

  return {
    async generateFromIdea(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      const modelId = deps.resolveModelId();

      // Phase 1: Title generation
      let effectiveTitle = book.title;

      if (book.titleGenerationStatus === 'pending') {
        updateTrackedPhase({
          bookId,
          phase: 'naming_title',
          stepLabel: '正在生成书名',
          notifyBookUpdated: true,
        });

        const generatedTitle = deps.outlineService.generateTitleFromIdea
          ? (
              await deps.outlineService.generateTitleFromIdea({
                bookId,
                title: book.title,
                idea: book.idea,
                targetChapters: book.targetChapters,
                wordsPerChapter: book.wordsPerChapter,
                viralStrategy: (book as any).viralStrategy ?? null,
                modelId,
              })
            ).trim()
          : '';

        const currentBook = deps.books.getById(bookId);
        if (!currentBook) {
          return;
        }

        if (currentBook.titleGenerationStatus !== 'pending') {
          effectiveTitle = currentBook.title;
        } else {
          effectiveTitle = generatedTitle || deriveTitleFromIdea(book.idea);
          deps.books.updateTitle(bookId, effectiveTitle);
          deps.books.updateTitleGenerationStatus(bookId, 'generated');
          deps.onBookUpdated?.(bookId);
        }
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
        title: effectiveTitle,
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
      saveOutlineBundle(deps, {
        bookId,
        bundle: outlineBundle,
        targetChapters: book.targetChapters,
      });

      // Phase 4: Final status update
      deps.books.updateStatus(bookId, 'building_outline');
      deps.progress.updatePhase(bookId, 'building_outline');
    },
  };
}
