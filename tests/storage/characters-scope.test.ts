import { describe, expect, it } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createCharacterRepository } from '@story-weaver/backend/storage/characters';

describe('character repository', () => {
  it('scopes repeated character ids to each book when listing latest states', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const characters = createCharacterRepository(db);

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

    characters.saveState({
      bookId: 'book-1',
      characterId: 'protagonist',
      characterName: 'Book One Hero',
      volumeIndex: 1,
      chapterIndex: 1,
      location: 'Archive',
    });
    characters.saveState({
      bookId: 'book-2',
      characterId: 'protagonist',
      characterName: 'Book Two Hero',
      volumeIndex: 1,
      chapterIndex: 1,
      location: 'Lighthouse',
    });

    expect(characters.listLatestStatesByBook('book-1')).toEqual([
      expect.objectContaining({
        characterId: 'protagonist',
        characterName: 'Book One Hero',
        location: 'Archive',
      }),
    ]);
    expect(characters.listLatestStatesByBook('book-2')).toEqual([
      expect.objectContaining({
        characterId: 'protagonist',
        characterName: 'Book Two Hero',
        location: 'Lighthouse',
      }),
    ]);
  });
});
