import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../../src/storage/database';
import { createBookRepository } from '../../src/storage/books';

describe('book repository', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists books by creation time descending even when an older book is updated', () => {
    const db = createDatabase(':memory:');
    const repo = createBookRepository(db);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T10:00:00.000Z'));
    repo.create({
      id: 'book-1',
      title: 'Book 1',
      idea: 'A city remembers every promise.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    vi.setSystemTime(new Date('2026-04-28T11:00:00.000Z'));
    repo.create({
      id: 'book-2',
      title: 'Book 2',
      idea: 'A lighthouse records every storm.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    vi.setSystemTime(new Date('2026-04-28T12:00:00.000Z'));
    repo.updateTitle('book-1', 'Promise Archive');

    expect(repo.list().map((book) => book.id)).toEqual(['book-2', 'book-1']);
  });
});
