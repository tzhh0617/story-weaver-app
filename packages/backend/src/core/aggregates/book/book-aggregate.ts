import { randomUUID } from 'node:crypto';
import type { BookRecord } from '@story-weaver/shared/contracts';
import { assertPositiveIntegerLimit } from '../../story-constraints.js';
import { buildBookDetailProjection } from './book-detail-projection.js';
import { INITIAL_BOOK_TITLE } from './book-state.js';
import type { BookAggregateDeps } from './book-aggregate-deps.js';

export type { BookAggregateDeps } from './book-aggregate-deps.js';

export function createBookAggregate(deps: BookAggregateDeps) {
  return {
    createBook(input: {
      title?: string;
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
      viralStrategy?: BookRecord['viralStrategy'];
    }) {
      assertPositiveIntegerLimit(
        input.targetChapters,
        'Target chapters must be a positive integer'
      );
      assertPositiveIntegerLimit(
        input.wordsPerChapter,
        'Words per chapter must be a positive integer'
      );

      const id = randomUUID();
      const title = input.title?.trim();
      let bookTitle = INITIAL_BOOK_TITLE;
      let titleGenerationStatus: BookRecord['titleGenerationStatus'] = 'pending';
      if (title) {
        bookTitle = title;
        titleGenerationStatus = 'manual';
      }

      deps.books.create({
        id,
        title: bookTitle,
        titleGenerationStatus,
        idea: input.idea,
        targetChapters: input.targetChapters,
        wordsPerChapter: input.wordsPerChapter,
        viralStrategy: input.viralStrategy ?? null,
      });

      deps.progress.updatePhase(id, 'creating');

      return id;
    },

    listBooks() {
      const books = deps.books.list();
      const batchedProgress = deps.chapters.listProgressByBookIds?.(
        books.map((book) => book.id)
      );

      return books.map((book) => {
        const chapterProgress = batchedProgress?.get(book.id);
        const chapters = chapterProgress
          ? null
          : deps.chapters.listByBook(book.id);
        const totalChapters = chapterProgress?.totalChapters ?? chapters?.length ?? 0;
        const completedChapters =
          chapterProgress?.completedChapters ??
          chapters?.filter((chapter) => Boolean(chapter.content)).length ??
          0;

        return {
          ...book,
          progress: totalChapters
            ? Math.round((completedChapters / totalChapters) * 100)
            : 0,
          completedChapters,
          totalChapters,
        };
      });
    },

    getBookDetail(bookId: string) {
      return buildBookDetailProjection(deps, bookId);
    },

    pauseBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'paused');
      deps.progress.updatePhase(bookId, 'paused');
    },

    deleteBook(bookId: string) {
      if (!deps.books.getById(bookId)) {
        return;
      }

      deps.chapters.deleteByBook(bookId);
      deps.plotThreads.clearByBook(bookId);
      deps.characters.deleteByBook(bookId);
      deps.sceneRecords.clearByBook(bookId);
      deps.progress.deleteByBook(bookId);
      deps.books.delete(bookId);
    },
  };
}
