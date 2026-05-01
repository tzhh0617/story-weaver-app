import { describe, expect, it } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createChapterRepository } from '@story-weaver/backend/storage/chapters';

describe('storage transaction safety', () => {
  it('book delete removes all related data atomically', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const chapters = createChapterRepository(db);

    books.create({
      id: 'book-1',
      title: 'Test',
      idea: 'Test idea',
      targetChapters: 1,
      wordsPerChapter: 1000,
    });
    chapters.upsertOutline({
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 1,
      title: 'Ch 1',
      outline: 'Test',
    });

    books.delete('book-1');

    expect(books.getById('book-1')).toBeUndefined();
    expect(chapters.listByBook('book-1')).toEqual([]);
  });

  it('book clearGeneratedState preserves book record', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);

    books.create({
      id: 'book-1',
      title: 'Test',
      idea: 'Test idea',
      targetChapters: 1,
      wordsPerChapter: 1000,
    });

    books.clearGeneratedState('book-1');

    const book = books.getById('book-1');
    expect(book).toBeDefined();
    expect(book!.id).toBe('book-1');
  });
});
