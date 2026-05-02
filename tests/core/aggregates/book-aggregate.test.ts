import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createChapterRepository } from '@story-weaver/backend/storage/chapters';
import { createCharacterRepository } from '@story-weaver/backend/storage/characters';
import { createPlotThreadRepository } from '@story-weaver/backend/storage/plot-threads';
import { createProgressRepository } from '@story-weaver/backend/storage/progress';
import { createSceneRecordRepository } from '@story-weaver/backend/storage/scene-records';
import { createBookAggregate } from '@story-weaver/backend/core/aggregates/book';
import type { BookAggregateDeps } from '@story-weaver/backend/core/aggregates/book';

function createTestAggregate(
  input: Partial<BookAggregateDeps>
) {
  const db = createDatabase(':memory:');

  const deps: BookAggregateDeps = {
    books: input.books ?? createBookRepository(db),
    chapters: input.chapters ?? createChapterRepository(db),
    sceneRecords: input.sceneRecords ?? createSceneRecordRepository(db),
    characters: input.characters ?? createCharacterRepository(db),
    plotThreads: input.plotThreads ?? createPlotThreadRepository(db),
    progress: input.progress ?? createProgressRepository(db),
    onBookUpdated: input.onBookUpdated,
    ...input,
  };

  return { aggregate: createBookAggregate(deps), db };
}

describe('createBookAggregate', () => {
  describe('createBook', () => {
    it('creates a book and returns a UUID', () => {
      const { aggregate } = createTestAggregate({});

      const bookId = aggregate.createBook({
        idea: 'A city remembers every promise.',
        targetChapters: 500,
        wordsPerChapter: 2500,
      });

      expect(bookId).toBeTruthy();
      expect(typeof bookId).toBe('string');
      expect(bookId.length).toBeGreaterThan(0);
    });

    it('persists the book with the initial title', () => {
      const { aggregate } = createTestAggregate({});

      const bookId = aggregate.createBook({
        idea: 'A city remembers every promise.',
        targetChapters: 500,
        wordsPerChapter: 2500,
      });

      const books = aggregate.listBooks();
      expect(books).toHaveLength(1);
      expect(books[0]).toMatchObject({
        id: bookId,
        title: '新作品',
        idea: 'A city remembers every promise.',
        targetChapters: 500,
        wordsPerChapter: 2500,
        status: 'creating',
      });
    });

    it('persists a manual title and marks title generation as manual', () => {
      const { aggregate } = createTestAggregate({});

      const bookId = aggregate.createBook({
        title: '月税奇谈',
        idea: 'A moon taxes every miracle.',
        targetChapters: 500,
        wordsPerChapter: 2500,
      });

      expect(aggregate.listBooks()[0]).toMatchObject({
        id: bookId,
        title: '月税奇谈',
        titleGenerationStatus: 'manual',
      });
    });

    it('marks title generation as pending when no title is provided', () => {
      const { aggregate } = createTestAggregate({});

      aggregate.createBook({
        idea: 'A moon taxes every miracle.',
        targetChapters: 500,
        wordsPerChapter: 2500,
      });

      expect(aggregate.listBooks()[0]).toMatchObject({
        title: '新作品',
        titleGenerationStatus: 'pending',
      });
    });

    it('treats a blank title as missing', () => {
      const { aggregate } = createTestAggregate({});

      aggregate.createBook({
        title: '   ',
        idea: 'A moon taxes every miracle.',
        targetChapters: 500,
        wordsPerChapter: 2500,
      });

      expect(aggregate.listBooks()[0]).toMatchObject({
        title: '新作品',
        titleGenerationStatus: 'pending',
      });
    });

    it('rejects zero target chapters', () => {
      const { aggregate } = createTestAggregate({});

      expect(() =>
        aggregate.createBook({
          idea: 'The moon taxes miracles.',
          targetChapters: 0,
          wordsPerChapter: 2500,
        })
      ).toThrow('Target chapters must be a positive integer');
    });

    it('rejects zero words per chapter', () => {
      const { aggregate } = createTestAggregate({});

      expect(() =>
        aggregate.createBook({
          idea: 'The moon taxes miracles.',
          targetChapters: 500,
          wordsPerChapter: 0,
        })
      ).toThrow('Words per chapter must be a positive integer');
    });

    it('rejects negative target chapters', () => {
      const { aggregate } = createTestAggregate({});

      expect(() =>
        aggregate.createBook({
          idea: 'The moon taxes miracles.',
          targetChapters: -5,
          wordsPerChapter: 2500,
        })
      ).toThrow('Target chapters must be a positive integer');
    });

    it('rejects fractional words per chapter', () => {
      const { aggregate } = createTestAggregate({});

      expect(() =>
        aggregate.createBook({
          idea: 'The moon taxes miracles.',
          targetChapters: 500,
          wordsPerChapter: 1.5,
        })
      ).toThrow('Words per chapter must be a positive integer');
    });

    it('does not persist a book when validation fails', () => {
      const { aggregate } = createTestAggregate({});

      try {
        aggregate.createBook({
          idea: 'Invalid',
          targetChapters: 0,
          wordsPerChapter: 2500,
        });
      } catch {
        // expected
      }

      expect(aggregate.listBooks()).toHaveLength(0);
    });
  });

  describe('listBooks', () => {
    it('returns an empty array when no books exist', () => {
      const { aggregate } = createTestAggregate({});

      expect(aggregate.listBooks()).toEqual([]);
    });

    it('lists books with chapter completion progress', () => {
      const db = createDatabase(':memory:');
      const books = createBookRepository(db);
      const chapters = createChapterRepository(db);
      const progress = createProgressRepository(db);
      const { aggregate } = createTestAggregate({ books, chapters, progress });

      const bookId = aggregate.createBook({
        idea: 'A city remembers every promise.',
        targetChapters: 2,
        wordsPerChapter: 2500,
      });

      chapters.upsertOutline({
        bookId,
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
        outline: 'Opening conflict',
      });
      chapters.upsertOutline({
        bookId,
        volumeIndex: 1,
        chapterIndex: 2,
        title: 'Chapter 2',
        outline: 'Escalation',
      });
      chapters.saveContent({
        bookId,
        volumeIndex: 1,
        chapterIndex: 1,
        content: 'Generated chapter content',
        summary: 'Summary',
        wordCount: 1200,
      });

      expect(aggregate.listBooks()[0]).toMatchObject({
        id: bookId,
        progress: 50,
        completedChapters: 1,
        totalChapters: 2,
      });
    });

    it('uses batched chapter progress when available', () => {
      const chapters = {
        upsertOutline: vi.fn(),
        listByBook: vi.fn(() => {
          throw new Error('listByBook should not be used for list progress');
        }),
        listProgressByBookIds: vi.fn(
          () =>
            new Map([
              ['book-1', { completedChapters: 1, totalChapters: 2 }],
              ['book-2', { completedChapters: 0, totalChapters: 0 }],
            ])
        ),
        saveContent: vi.fn(),
        deleteByBook: vi.fn(),
      };
      const { aggregate } = createTestAggregate({
        books: {
          create: vi.fn(),
          list: vi.fn(() => [
            {
              id: 'book-1',
              title: 'Book 1',
              titleGenerationStatus: 'manual',
              idea: 'A city remembers every promise.',
              status: 'writing',
              targetChapters: 2,
              wordsPerChapter: 2500,
              createdAt: '2026-04-30T00:00:00.000Z',
              updatedAt: '2026-04-30T00:00:00.000Z',
            },
            {
              id: 'book-2',
              title: 'Book 2',
              titleGenerationStatus: 'manual',
              idea: 'A lighthouse records every storm.',
              status: 'creating',
              targetChapters: 1,
              wordsPerChapter: 2500,
              createdAt: '2026-04-30T00:00:00.000Z',
              updatedAt: '2026-04-30T00:00:00.000Z',
            },
          ]),
          getById: vi.fn(),
          updateStatus: vi.fn(),
          delete: vi.fn(),
          getContext: vi.fn(),
        },
        chapters,
      });

      expect(aggregate.listBooks()).toEqual([
        expect.objectContaining({
          id: 'book-1',
          progress: 50,
          completedChapters: 1,
          totalChapters: 2,
        }),
        expect.objectContaining({
          id: 'book-2',
          progress: 0,
          completedChapters: 0,
          totalChapters: 0,
        }),
      ]);
      expect(chapters.listProgressByBookIds).toHaveBeenCalledWith([
        'book-1',
        'book-2',
      ]);
      expect(chapters.listByBook).not.toHaveBeenCalled();
    });

    it('returns 0 progress when book has no chapters', () => {
      const { aggregate } = createTestAggregate({});

      aggregate.createBook({
        idea: 'A city remembers every promise.',
        targetChapters: 2,
        wordsPerChapter: 2500,
      });

      const books = aggregate.listBooks();
      expect(books[0]).toMatchObject({
        progress: 0,
        completedChapters: 0,
        totalChapters: 0,
      });
    });
  });

  describe('getBookDetail', () => {
    it('returns null for nonexistent book', () => {
      const { aggregate } = createTestAggregate({});

      expect(aggregate.getBookDetail('nonexistent-id')).toBeNull();
    });

    it('returns book detail after creation', () => {
      const { aggregate } = createTestAggregate({});

      const bookId = aggregate.createBook({
        idea: 'The moon taxes miracles.',
        targetChapters: 1,
        wordsPerChapter: 2500,
      });

      const detail = aggregate.getBookDetail(bookId);

      expect(detail).not.toBeNull();
      expect(detail?.book).toMatchObject({
        id: bookId,
        title: '新作品',
        idea: 'The moon taxes miracles.',
        targetChapters: 1,
        wordsPerChapter: 2500,
      });
      expect(detail?.chapters).toEqual([]);
      expect(detail?.plotThreads).toEqual([]);
      expect(detail?.characterStates).toEqual([]);
      expect(detail?.latestScene).toBeNull();
      expect(detail?.narrative.storyBible).toBeNull();
      expect(detail?.progress).not.toBeNull();
    });

    it('returns story route plans on chapter detail records', async () => {
      const db = createDatabase(':memory:');
      const books = createBookRepository(db);
      const chapters = createChapterRepository(db);
      const progress = createProgressRepository(db);
      const { aggregate } = createTestAggregate({ books, chapters, progress });

      const bookId = aggregate.createBook({
        idea: '命簿',
        targetChapters: 1,
        wordsPerChapter: 1200,
      });

      chapters.upsertOutline({
        bookId,
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
        outline: 'Opening conflict',
      });

      const detail = aggregate.getBookDetail(bookId);

      expect(detail?.chapters[0]?.storyRoutePlan).toMatchObject({
        taskType: 'write_chapter',
      });
      expect(
        detail?.chapters[0]?.storyRoutePlan?.requiredSkills.map((skill) => skill.id)
      ).toContain('chapter-goal');
    });
  });

  describe('pauseBook', () => {
    it('pauses a book and updates the status', () => {
      const { aggregate } = createTestAggregate({});

      const bookId = aggregate.createBook({
        idea: 'The moon taxes miracles.',
        targetChapters: 2,
        wordsPerChapter: 2500,
      });

      aggregate.pauseBook(bookId);

      const detail = aggregate.getBookDetail(bookId);
      expect(detail?.book.status).toBe('paused');
      expect(detail?.progress?.phase).toBe('paused');
    });

    it('throws when book not found', () => {
      const { aggregate } = createTestAggregate({});

      expect(() => aggregate.pauseBook('nonexistent-id')).toThrow(
        'Book not found: nonexistent-id'
      );
    });
  });

  describe('deleteBook', () => {
    it('deletes a book and clears all associated data', () => {
      const { aggregate } = createTestAggregate({});

      const bookId = aggregate.createBook({
        idea: 'The moon taxes miracles.',
        targetChapters: 500,
        wordsPerChapter: 2500,
      });

      aggregate.deleteBook(bookId);

      expect(aggregate.listBooks()).toEqual([]);
      expect(aggregate.getBookDetail(bookId)).toBeNull();
    });

    it('does nothing when deleting a nonexistent book', () => {
      const { aggregate } = createTestAggregate({});

      aggregate.createBook({
        idea: 'Existing book',
        targetChapters: 1,
        wordsPerChapter: 2500,
      });

      aggregate.deleteBook('nonexistent-id');

      expect(aggregate.listBooks()).toHaveLength(1);
    });
  });

});
