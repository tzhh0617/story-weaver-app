import type { ChapterCard } from '../../narrative/types.js';
import { buildOutlineFromChapterCard } from './chapter-types.js';

export type ChapterDiscoveryDeps = {
  books: {
    getById: (bookId: string) =>
      | {
          id: string;
          title: string;
          idea: string;
          status: string;
          targetChapters: number;
          wordsPerChapter: number;
          viralStrategy?: import('@story-weaver/shared/contracts').BookRecord['viralStrategy'];
          createdAt: string;
          updatedAt: string;
        }
      | undefined;
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
  };
  chapterCards?: {
    listByBook?: (bookId: string) => ChapterCard[];
    getNextUnwritten?: (bookId: string) => ChapterCard | null;
  };
};

export type ChapterDiscoveryResult = {
  book: NonNullable<ReturnType<ChapterDiscoveryDeps['books']['getById']>>;
  context: ReturnType<ChapterDiscoveryDeps['books']['getContext']>;
  chapters: ReturnType<ChapterDiscoveryDeps['chapters']['listByBook']>;
  nextChapter: NonNullable<ReturnType<ChapterDiscoveryDeps['chapters']['listByBook']>[number]>;
  chapterCard: ChapterCard | null;
  outline: string;
  title: string;
};

export function createChapterDiscovery(deps: ChapterDiscoveryDeps) {
  function findNextChapter(input: { bookId: string }): ChapterDiscoveryResult {
    const book = deps.books.getById(input.bookId);
    if (!book) {
      throw new Error(`Book not found: ${input.bookId}`);
    }

    const context = deps.books.getContext(input.bookId);
    const chapters = deps.chapters.listByBook(input.bookId);
    const chapterCards = deps.chapterCards?.listByBook?.(input.bookId) ?? [];
    const nextChapter = chapters.find(
      (chapter) =>
        !chapter.content &&
        (Boolean(chapter.outline?.trim()) ||
          chapterCards.some(
            (card) =>
              card.volumeIndex === chapter.volumeIndex &&
              card.chapterIndex === chapter.chapterIndex
          ))
    );

    if (!nextChapter) {
      throw new Error('No outlined chapter available to write');
    }

    const chapterCard =
      chapterCards.find(
        (card) =>
          card.volumeIndex === nextChapter.volumeIndex &&
          card.chapterIndex === nextChapter.chapterIndex
      ) ?? null;
    const nextChapterOutline =
      nextChapter.outline?.trim() ||
      (chapterCard ? buildOutlineFromChapterCard(chapterCard) : '');
    const nextChapterTitle = nextChapter.title ?? chapterCard?.title;

    if (!nextChapterOutline || !nextChapterTitle) {
      throw new Error('No outlined chapter available to write');
    }

    return {
      book,
      context,
      chapters,
      nextChapter,
      chapterCard,
      outline: nextChapterOutline,
      title: nextChapterTitle,
    };
  }

  return { findNextChapter };
}
