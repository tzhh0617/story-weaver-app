import { describe, expect, it } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createPlotThreadRepository } from '@story-weaver/backend/storage/plot-threads';

describe('plot thread repository', () => {
  it('scopes thread ids and resolution to one book', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const plotThreads = createPlotThreadRepository(db);

    books.create({
      id: 'book-1',
      title: 'Book 1',
      idea: 'A city remembers every promise.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });
    books.create({
      id: 'book-2',
      title: 'Book 2',
      idea: 'A lighthouse records every storm.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    plotThreads.upsertThread({
      id: 'thread-1',
      bookId: 'book-1',
      description: 'Book one thread',
      plantedAt: 1,
      expectedPayoff: 3,
    });
    plotThreads.upsertThread({
      id: 'thread-1',
      bookId: 'book-2',
      description: 'Book two thread',
      plantedAt: 1,
      expectedPayoff: 4,
    });

    plotThreads.resolveThread('book-1', 'thread-1', 2);

    expect(plotThreads.listByBook('book-1')).toEqual([
      expect.objectContaining({
        id: 'thread-1',
        description: 'Book one thread',
        resolvedAt: 2,
      }),
    ]);
    expect(plotThreads.listByBook('book-2')).toEqual([
      expect.objectContaining({
        id: 'thread-1',
        description: 'Book two thread',
        resolvedAt: null,
      }),
    ]);
  });
});
