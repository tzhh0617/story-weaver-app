import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/storage/database';
import { createBookRepository } from '../../src/storage/books';

describe('book repository', () => {
  it('inserts and lists books in updated order', () => {
    const db = createDatabase(':memory:');
    const repo = createBookRepository(db);

    repo.create({
      id: 'book-1',
      title: 'Book 1',
      idea: 'A city remembers every promise.',
      targetWords: 500000,
    });

    expect(repo.list()[0]?.id).toBe('book-1');
  });
});
