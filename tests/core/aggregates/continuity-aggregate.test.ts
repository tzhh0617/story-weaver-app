import { describe, expect, it } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createPlotThreadRepository } from '@story-weaver/backend/storage/plot-threads';
import { createSceneRecordRepository } from '@story-weaver/backend/storage/scene-records';
import { createCharacterRepository } from '@story-weaver/backend/storage/characters';
import { createContinuityAggregate } from '@story-weaver/backend/core/aggregates/continuity/continuity-aggregate';

const DEFAULT_BOOK_ID = 'book-1';

function createTestAggregate(bookId = DEFAULT_BOOK_ID) {
  const db = createDatabase(':memory:');
  const books = createBookRepository(db);
  books.create({
    id: bookId,
    title: 'Test Book',
    idea: 'A test story.',
    targetChapters: 10,
    wordsPerChapter: 2500,
  });

  const plotThreads = createPlotThreadRepository(db);
  const sceneRecords = createSceneRecordRepository(db);
  const characters = createCharacterRepository(db);

  const aggregate = createContinuityAggregate({
    plotThreads,
    sceneRecords,
    characters,
  });

  return { aggregate, plotThreads, sceneRecords, characters, db };
}

describe('createContinuityAggregate', () => {
  const bookId = 'book-1';
  const volumeIndex = 1;
  const chapterIndex = 3;

  describe('updateFromChapter', () => {
    it('saves opened plot threads', () => {
      const { aggregate, plotThreads } = createTestAggregate();

      aggregate.updateFromChapter(bookId, volumeIndex, chapterIndex, {
        openedThreads: [
          {
            id: 'thread-1',
            description: 'A mysterious key appears',
            plantedAt: chapterIndex,
            expectedPayoff: 10,
            importance: 'major',
          },
          {
            id: 'thread-2',
            description: 'Shadow in the garden',
            plantedAt: chapterIndex,
          },
        ],
        resolvedThreadIds: [],
        characterStates: [],
        scene: null,
      });

      const threads = plotThreads.listByBook(bookId);
      expect(threads).toHaveLength(2);
      expect(threads[0]).toMatchObject({
        id: 'thread-1',
        bookId,
        description: 'A mysterious key appears',
        plantedAt: chapterIndex,
        expectedPayoff: 10,
        importance: 'major',
        resolvedAt: null,
      });
      expect(threads[1]).toMatchObject({
        id: 'thread-2',
        description: 'Shadow in the garden',
        importance: 'normal',
      });
    });

    it('resolves plot threads', () => {
      const { aggregate, plotThreads } = createTestAggregate();

      // First plant a thread
      plotThreads.upsertThread({
        id: 'thread-1',
        bookId,
        description: 'Old mystery',
        plantedAt: 1,
      });
      expect(plotThreads.listByBook(bookId)[0].resolvedAt).toBeNull();

      // Resolve it via updateFromChapter
      aggregate.updateFromChapter(bookId, volumeIndex, chapterIndex, {
        openedThreads: [],
        resolvedThreadIds: ['thread-1'],
        characterStates: [],
        scene: null,
      });

      const threads = plotThreads.listByBook(bookId);
      expect(threads).toHaveLength(1);
      expect(threads[0].resolvedAt).toBe(chapterIndex);
    });

    it('saves character states', () => {
      const { aggregate, characters } = createTestAggregate();

      aggregate.updateFromChapter(bookId, volumeIndex, chapterIndex, {
        openedThreads: [],
        resolvedThreadIds: [],
        characterStates: [
          {
            characterId: 'char-1',
            characterName: 'Lin',
            location: 'Forest',
            status: 'wounded',
            knowledge: 'Knows the secret path',
            emotion: 'determined',
            powerLevel: 'low',
          },
          {
            characterId: 'char-2',
            characterName: 'Kai',
            location: null,
            status: null,
          },
        ],
        scene: null,
      });

      const states = characters.listLatestStatesByBook(bookId);
      expect(states).toHaveLength(2);
      expect(states[0]).toMatchObject({
        characterId: 'char-1',
        characterName: 'Lin',
        location: 'Forest',
        status: 'wounded',
        knowledge: 'Knows the secret path',
        emotion: 'determined',
        powerLevel: 'low',
      });
      expect(states[1]).toMatchObject({
        characterId: 'char-2',
        characterName: 'Kai',
        location: null,
        status: null,
      });
    });

    it('saves scene records when scene is provided', () => {
      const { aggregate, sceneRecords } = createTestAggregate();

      aggregate.updateFromChapter(bookId, volumeIndex, chapterIndex, {
        openedThreads: [],
        resolvedThreadIds: [],
        characterStates: [],
        scene: {
          location: 'The old tower',
          timeInStory: 'Midnight',
          charactersPresent: ['Lin', 'Kai'],
          events: 'A duel breaks out',
        },
      });

      const scene = sceneRecords.getLatestByBook(bookId);
      expect(scene).toMatchObject({
        bookId,
        volumeIndex,
        chapterIndex,
        location: 'The old tower',
        timeInStory: 'Midnight',
        charactersPresent: ['Lin', 'Kai'],
        events: 'A duel breaks out',
      });
    });

    it('skips scene record when scene is null', () => {
      const { aggregate, sceneRecords } = createTestAggregate();

      aggregate.updateFromChapter(bookId, volumeIndex, chapterIndex, {
        openedThreads: [],
        resolvedThreadIds: [],
        characterStates: [],
        scene: null,
      });

      const scene = sceneRecords.getLatestByBook(bookId);
      expect(scene).toBeNull();
    });

    it('handles a full chapter update with all data types', () => {
      const { aggregate, plotThreads, characters, sceneRecords } =
        createTestAggregate();

      // Seed an existing thread to resolve
      plotThreads.upsertThread({
        id: 'thread-old',
        bookId,
        description: 'An old question',
        plantedAt: 1,
      });

      aggregate.updateFromChapter(bookId, volumeIndex, chapterIndex, {
        openedThreads: [
          {
            id: 'thread-new',
            description: 'A new mystery',
            plantedAt: chapterIndex,
            expectedPayoff: 8,
          },
        ],
        resolvedThreadIds: ['thread-old'],
        characterStates: [
          {
            characterId: 'char-1',
            characterName: 'Hero',
            location: 'Castle',
            status: 'ready',
          },
        ],
        scene: {
          location: 'Throne room',
          timeInStory: 'Dawn',
          charactersPresent: ['Hero'],
        },
      });

      // Verify threads
      const threads = plotThreads.listByBook(bookId);
      expect(threads).toHaveLength(2);
      const resolved = threads.find((t) => t.id === 'thread-old');
      expect(resolved?.resolvedAt).toBe(chapterIndex);
      const opened = threads.find((t) => t.id === 'thread-new');
      expect(opened?.resolvedAt).toBeNull();

      // Verify character state
      const states = characters.listLatestStatesByBook(bookId);
      expect(states).toHaveLength(1);
      expect(states[0].characterName).toBe('Hero');

      // Verify scene
      const scene = sceneRecords.getLatestByBook(bookId);
      expect(scene?.location).toBe('Throne room');
    });
  });

  describe('clearByBook', () => {
    it('clears all continuity data for a book', () => {
      const { aggregate, plotThreads, characters, sceneRecords } =
        createTestAggregate();

      // Seed all data types
      plotThreads.upsertThread({
        id: 't1',
        bookId,
        description: 'Thread',
        plantedAt: 1,
      });
      aggregate.updateFromChapter(bookId, volumeIndex, chapterIndex, {
        openedThreads: [],
        resolvedThreadIds: [],
        characterStates: [
          {
            characterId: 'c1',
            characterName: 'A',
            location: 'Here',
          },
        ],
        scene: {
          location: 'Place',
          timeInStory: 'Now',
          charactersPresent: ['A'],
        },
      });

      // Verify data exists
      expect(plotThreads.listByBook(bookId)).toHaveLength(1);
      expect(characters.listLatestStatesByBook(bookId)).toHaveLength(1);
      expect(sceneRecords.getLatestByBook(bookId)).not.toBeNull();

      // Clear
      aggregate.clearByBook(bookId);

      // Verify all cleared
      expect(plotThreads.listByBook(bookId)).toHaveLength(0);
      expect(characters.listLatestStatesByBook(bookId)).toHaveLength(0);
      expect(sceneRecords.getLatestByBook(bookId)).toBeNull();
    });

    it('does not affect data from other books', () => {
      const db = createDatabase(':memory:');
      const books = createBookRepository(db);
      books.create({ id: bookId, title: 'Book 1', idea: 'A', targetChapters: 10, wordsPerChapter: 2500 });
      const otherBookId = 'book-2';
      books.create({ id: otherBookId, title: 'Book 2', idea: 'B', targetChapters: 10, wordsPerChapter: 2500 });

      const plotThreads = createPlotThreadRepository(db);
      const sceneRecords = createSceneRecordRepository(db);
      const characters = createCharacterRepository(db);
      const aggregate = createContinuityAggregate({ plotThreads, sceneRecords, characters });

      // Seed data for both books
      plotThreads.upsertThread({
        id: 't1',
        bookId,
        description: 'Book 1 thread',
        plantedAt: 1,
      });
      plotThreads.upsertThread({
        id: 't2',
        bookId: otherBookId,
        description: 'Book 2 thread',
        plantedAt: 1,
      });

      aggregate.clearByBook(bookId);

      // Book 1 data is gone
      expect(plotThreads.listByBook(bookId)).toHaveLength(0);
      // Book 2 data is untouched
      expect(plotThreads.listByBook(otherBookId)).toHaveLength(1);
    });
  });
});
