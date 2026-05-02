import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createChapterRepository } from '@story-weaver/backend/storage/chapters';
import { createProgressRepository } from '@story-weaver/backend/storage/progress';
import { createOutlineAggregate } from '@story-weaver/backend/core/aggregates/outline';
import type { OutlineAggregateDeps } from '@story-weaver/backend/core/aggregates/outline';

const BOOK_ID = 'test-book-id';

/**
 * Creates a test setup with a real in-memory database.
 * Creates a book with id=BOOK_ID and status='building_world'.
 */
function createDefaultSetup(overrides?: {
  outlineService?: OutlineAggregateDeps['outlineService'];
  storyBibles?: OutlineAggregateDeps['storyBibles'];
  volumePlans?: OutlineAggregateDeps['volumePlans'];
  chapterCards?: OutlineAggregateDeps['chapterCards'];
  chapterTensionBudgets?: OutlineAggregateDeps['chapterTensionBudgets'];
  targetChapters?: number;
  wordsPerChapter?: number;
  idea?: string;
  viralStrategy?: any;
}) {
  const db = createDatabase(':memory:');
  const books = createBookRepository(db);
  const chapters = createChapterRepository(db);
  const progress = createProgressRepository(db);
  const resolveModelId = vi.fn().mockReturnValue('test:model');
  const onBookUpdated = vi.fn();
  const onGenerationEvent = vi.fn();

  const targetChapters = overrides?.targetChapters ?? 1;
  const wordsPerChapter = overrides?.wordsPerChapter ?? 2500;
  const idea = overrides?.idea ?? 'A city remembers every promise.';

  books.create({
    id: BOOK_ID,
    title: '新作品',
    idea,
    targetChapters,
    wordsPerChapter,
    viralStrategy: overrides?.viralStrategy ?? null,
    titleGenerationStatus: 'pending',
  });
  books.updateStatus(BOOK_ID, 'building_world');

  const deps: OutlineAggregateDeps = {
    books,
    chapters,
    progress,
    outlineService:
      overrides?.outlineService ??
      ({
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [],
        }),
      } as any),
    resolveModelId,
    onBookUpdated,
    onGenerationEvent,
    storyBibles: overrides?.storyBibles,
    volumePlans: overrides?.volumePlans,
    chapterCards: overrides?.chapterCards,
    chapterTensionBudgets: overrides?.chapterTensionBudgets,
  };

  const aggregate = createOutlineAggregate(deps);

  return { aggregate, deps, bookId: BOOK_ID, db, onBookUpdated, onGenerationEvent, resolveModelId, books, chapters, progress };
}

/**
 * Creates a setup where getById can be controlled via a flag to simulate
 * mid-generation deletion without actually deleting the book (avoids FK issues).
 */
function createDeletionTestSetup(overrides: {
  deleteAfterTitle?: boolean;
  deleteDuringGeneration?: boolean;
  deleteBeforeWorldSetting?: boolean;
  deleteBeforeMasterOutline?: boolean;
  deleteBeforeChapterOutlines?: boolean;
  deleteAfterGeneration?: boolean;
}) {
  const db = createDatabase(':memory:');
  const books = createBookRepository(db);
  const chapters = createChapterRepository(db);
  const progress = createProgressRepository(db);
  const saveGraph = vi.fn();
  const onBookUpdated = vi.fn();
  const onGenerationEvent = vi.fn();

  const bookId = BOOK_ID;
  books.create({
    id: bookId,
    title: '新作品',
    idea: 'Test',
    targetChapters: 1,
    wordsPerChapter: 2500,
    viralStrategy: null,
    titleGenerationStatus: 'pending',
  });
  books.updateStatus(bookId, 'building_world');

  // Wrap books.getById to simulate deletion
  let bookExists = true;
  const originalGetById = books.getById.bind(books);
  const wrappedBooks = {
    ...books,
    getById: (id: string) => (bookExists ? originalGetById(id) : undefined),
    simulateDeletion: () => { bookExists = false; },
  };

  const generateFromIdea = vi.fn().mockImplementation(async (input: any) => {
    if (overrides.deleteBeforeWorldSetting) {
      wrappedBooks.simulateDeletion();
    }
    input.onWorldSetting?.('World setting');

    if (overrides.deleteBeforeMasterOutline) {
      wrappedBooks.simulateDeletion();
    }
    input.onMasterOutline?.('Master outline');

    if (overrides.deleteBeforeChapterOutlines) {
      wrappedBooks.simulateDeletion();
    }
    input.onChapterOutlines?.([
      { volumeIndex: 1, chapterIndex: 1, title: 'Chapter 1', outline: 'Opening' },
    ]);

    if (overrides.deleteAfterGeneration) {
      wrappedBooks.simulateDeletion();
    }

    return {
      worldSetting: 'World',
      masterOutline: 'Outline',
      volumeOutlines: [],
      chapterOutlines: [],
    };
  });

  const generateTitleFromIdea = vi.fn().mockImplementation(async () => {
    if (overrides.deleteAfterTitle) {
      wrappedBooks.simulateDeletion();
    }
    return 'Generated Title';
  });

  const deps: OutlineAggregateDeps = {
    books: wrappedBooks as any,
    chapters,
    progress,
    outlineService: {
      ...(overrides.deleteAfterTitle ? { generateTitleFromIdea } : {}),
      generateFromIdea,
    },
    storyBibles: { saveGraph },
    resolveModelId: vi.fn().mockReturnValue('test:model'),
    onBookUpdated,
    onGenerationEvent,
  };

  const aggregate = createOutlineAggregate(deps);

  return { aggregate, bookId, saveGraph, generateFromIdea, chapters, onBookUpdated, onGenerationEvent };
}

describe('createOutlineAggregate', () => {
  describe('generateFromIdea', () => {
    it('generates an outline from an idea and persists world setting and outline', async () => {
      const { aggregate, bookId, books, chapters } = createDefaultSetup({
        outlineService: {
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'A world where memories are currency.',
            masterOutline: 'Hero discovers forgotten truth.',
            volumeOutlines: ['Volume 1'],
            chapterOutlines: [
              { volumeIndex: 1, chapterIndex: 1, title: 'Chapter 1', outline: 'Opening' },
            ],
          }),
        },
      });

      await aggregate.generateFromIdea(bookId);

      const context = books.getContext(bookId);
      expect(context?.worldSetting).toBe('A world where memories are currency.');
      expect(context?.outline).toBe('Hero discovers forgotten truth.');

      const chapterList = chapters.listByBook(bookId);
      expect(chapterList).toHaveLength(1);
      expect(chapterList[0]).toMatchObject({
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
        outline: 'Opening',
      });
    });

    it('throws if book is not found', async () => {
      const { aggregate } = createDefaultSetup();

      await expect(aggregate.generateFromIdea('nonexistent-id')).rejects.toThrow(
        'Book not found: nonexistent-id'
      );
    });

    it('uses resolveModelId to determine the model', async () => {
      const generateFromIdea = vi.fn().mockResolvedValue({
        worldSetting: 'World',
        masterOutline: 'Outline',
        volumeOutlines: [],
        chapterOutlines: [],
      });
      const { aggregate, bookId, resolveModelId } = createDefaultSetup({
        outlineService: { generateFromIdea },
      });

      await aggregate.generateFromIdea(bookId);

      expect(resolveModelId).toHaveBeenCalled();
      expect(generateFromIdea).toHaveBeenCalledWith(
        expect.objectContaining({ modelId: 'test:model' })
      );
    });

    it('generates a title when generateTitleFromIdea is available', async () => {
      const { aggregate, bookId, books } = createDefaultSetup({
        outlineService: {
          generateTitleFromIdea: vi.fn().mockResolvedValue('月税奇谈'),
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World rules',
            masterOutline: 'Master outline',
            volumeOutlines: [],
            chapterOutlines: [],
          }),
        },
      });

      await aggregate.generateFromIdea(bookId);

      const updatedBook = books.getById(bookId);
      expect(updatedBook?.title).toBe('月税奇谈');
    });

    it('does not generate a title for manual titles', async () => {
      const generateTitleFromIdea = vi.fn().mockResolvedValue('系统标题');
      const generateFromIdea = vi.fn().mockResolvedValue({
        worldSetting: 'World',
        masterOutline: 'Outline',
        volumeOutlines: [],
        chapterOutlines: [],
      });
      const { aggregate, bookId, books } = createDefaultSetup({
        outlineService: { generateTitleFromIdea, generateFromIdea },
      });
      books.updateTitle(bookId, '手填标题');
      books.updateTitleGenerationStatus(bookId, 'manual');

      await aggregate.generateFromIdea(bookId);

      expect(generateTitleFromIdea).not.toHaveBeenCalled();
      expect(books.getById(bookId)).toMatchObject({
        title: '手填标题',
        titleGenerationStatus: 'manual',
      });
    });

    it('marks generated title status after pending title generation', async () => {
      const generateTitleFromIdea = vi.fn().mockResolvedValue('月税奇谈');
      const { aggregate, bookId, books } = createDefaultSetup({
        outlineService: {
          generateTitleFromIdea,
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World',
            masterOutline: 'Outline',
            volumeOutlines: [],
            chapterOutlines: [],
          }),
        },
      });

      await aggregate.generateFromIdea(bookId);

      expect(books.getById(bookId)).toMatchObject({
        title: '月税奇谈',
        titleGenerationStatus: 'generated',
      });
    });

    it('keeps a manual title set while title generation is in flight', async () => {
      const generateFromIdea = vi.fn().mockResolvedValue({
        worldSetting: 'World',
        masterOutline: 'Outline',
        volumeOutlines: [],
        chapterOutlines: [],
      });
      const { aggregate, bookId, books, deps } = createDefaultSetup({
        outlineService: { generateFromIdea },
      });
      deps.outlineService.generateTitleFromIdea = vi.fn().mockImplementation(async () => {
        books.updateTitle(bookId, '手动抢先标题');
        books.updateTitleGenerationStatus(bookId, 'manual');
        return '系统标题';
      });

      await aggregate.generateFromIdea(bookId);

      expect(books.getById(bookId)).toMatchObject({
        title: '手动抢先标题',
        titleGenerationStatus: 'manual',
      });
      expect(generateFromIdea).toHaveBeenCalledWith(
        expect.objectContaining({ title: '手动抢先标题' })
      );
    });

    it('passes the final title into outline generation', async () => {
      const generateFromIdea = vi.fn().mockResolvedValue({
        worldSetting: 'World',
        masterOutline: 'Outline',
        volumeOutlines: [],
        chapterOutlines: [],
      });
      const { aggregate, bookId } = createDefaultSetup({
        outlineService: {
          generateTitleFromIdea: vi.fn().mockResolvedValue('月税奇谈'),
          generateFromIdea,
        },
      });

      await aggregate.generateFromIdea(bookId);

      expect(generateFromIdea).toHaveBeenCalledWith(
        expect.objectContaining({ title: '月税奇谈' })
      );
    });

    it('falls back to deriveTitleFromIdea when generated title is empty', async () => {
      // deriveTitleFromIdea truncates at 48 chars
      const longIdea = 'A very long and detailed idea about the moon taxing miracles';
      const expectedTitle = `${longIdea.slice(0, 48)}...`;

      const { aggregate, bookId, books } = createDefaultSetup({
        idea: longIdea,
        outlineService: {
          generateTitleFromIdea: vi.fn().mockResolvedValue('   '),
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World',
            masterOutline: 'Outline',
            volumeOutlines: [],
            chapterOutlines: [],
          }),
        },
      });

      await aggregate.generateFromIdea(bookId);

      const updatedBook = books.getById(bookId);
      expect(updatedBook?.title).toBe(expectedTitle);
    });

    it('saves world setting during streaming onWorldSetting callback', async () => {
      const { aggregate, bookId, books, onBookUpdated } = createDefaultSetup({
        outlineService: {
          generateFromIdea: vi.fn().mockImplementation(async (input) => {
            input.onWorldSetting?.('Early world setting');
            return {
              worldSetting: 'Early world setting',
              masterOutline: 'Final outline',
              volumeOutlines: [],
              chapterOutlines: [],
            };
          }),
        },
      });

      await aggregate.generateFromIdea(bookId);

      const context = books.getContext(bookId);
      expect(context?.worldSetting).toBe('Early world setting');
      expect(onBookUpdated).toHaveBeenCalledWith(bookId);
    });

    it('saves master outline during streaming onMasterOutline callback', async () => {
      const { aggregate, bookId, books } = createDefaultSetup({
        outlineService: {
          generateFromIdea: vi.fn().mockImplementation(async (input) => {
            input.onWorldSetting?.('World setting');
            input.onMasterOutline?.('Early master outline');
            return {
              worldSetting: 'World setting',
              masterOutline: 'Early master outline',
              volumeOutlines: [],
              chapterOutlines: [],
            };
          }),
        },
      });

      await aggregate.generateFromIdea(bookId);

      const context = books.getContext(bookId);
      expect(context?.worldSetting).toBe('World setting');
      expect(context?.outline).toBe('Early master outline');
    });

    it('saves chapter outlines during streaming onChapterOutlines callback', async () => {
      // The streaming callback saves chapters, and the final chapterOutlines
      // must match to avoid normalizeChapterOutlinesToTarget overwriting them.
      const { aggregate, bookId, chapters, onBookUpdated } = createDefaultSetup({
        targetChapters: 1,
        outlineService: {
          generateFromIdea: vi.fn().mockImplementation(async (input) => {
            input.onChapterOutlines?.([
              { volumeIndex: 1, chapterIndex: 1, title: '早来的第一章', outline: 'Opening conflict' },
            ]);
            return {
              worldSetting: 'World',
              masterOutline: 'Outline',
              volumeOutlines: [],
              chapterOutlines: [
                { volumeIndex: 1, chapterIndex: 1, title: '早来的第一章', outline: 'Opening conflict' },
              ],
            };
          }),
        },
      });

      await aggregate.generateFromIdea(bookId);

      const chapterList = chapters.listByBook(bookId);
      expect(chapterList).toHaveLength(1);
      expect(chapterList[0]).toMatchObject({
        title: '早来的第一章',
        outline: 'Opening conflict',
      });
      expect(onBookUpdated).toHaveBeenCalledWith(bookId);
    });

    it('saves narrative bible after generation', async () => {
      const saveGraph = vi.fn();
      const { aggregate, bookId } = createDefaultSetup({
        outlineService: {
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World',
            masterOutline: 'Outline',
            volumeOutlines: [],
            chapterOutlines: [],
            narrativeBible: {
              premise: 'Test premise',
              genreContract: 'Test genre',
              characterArcs: [],
              relationshipEdges: [],
              worldRules: [],
              narrativeThreads: [],
            },
          }),
        },
        storyBibles: { saveGraph },
      });

      await aggregate.generateFromIdea(bookId);

      expect(saveGraph).toHaveBeenCalledWith(
        bookId,
        expect.objectContaining({ premise: 'Test premise' })
      );
    });

    it('saves volume plans after generation', async () => {
      const upsertMany = vi.fn();
      const { aggregate, bookId } = createDefaultSetup({
        outlineService: {
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World',
            masterOutline: 'Outline',
            volumeOutlines: [],
            chapterOutlines: [],
            volumePlans: [
              { volumeIndex: 1, title: 'Volume 1', chapterStart: 1, chapterEnd: 10, promisedPayoff: 'Climax' },
            ],
          }),
        },
        volumePlans: { upsertMany },
      });

      await aggregate.generateFromIdea(bookId);

      expect(upsertMany).toHaveBeenCalledWith(
        bookId,
        expect.arrayContaining([
          expect.objectContaining({ title: 'Volume 1' }),
        ])
      );
    });

    it('saves chapter cards after generation', async () => {
      const upsertMany = vi.fn();
      const { aggregate, bookId } = createDefaultSetup({
        outlineService: {
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World',
            masterOutline: 'Outline',
            volumeOutlines: [],
            chapterOutlines: [],
            chapterCards: [
              {
                bookId: BOOK_ID,
                volumeIndex: 1,
                chapterIndex: 1,
                title: 'Chapter 1',
                plotFunction: 'Opening',
                povCharacterId: null,
                externalConflict: 'External',
                internalConflict: 'Internal',
                relationshipChange: 'Change',
                mustChange: 'Must change',
                readerReward: 'truth',
                endingHook: 'Hook',
              },
            ],
          }),
        },
        chapterCards: { upsertMany } as any,
      });

      await aggregate.generateFromIdea(bookId);

      expect(upsertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Chapter 1' }),
        ])
      );
    });

    it('saves chapter tension budgets after generation', async () => {
      const upsertManyBudgets = vi.fn();
      const { aggregate, bookId } = createDefaultSetup({
        outlineService: {
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World',
            masterOutline: 'Outline',
            volumeOutlines: [],
            chapterOutlines: [],
            chapterTensionBudgets: [
              {
                bookId: BOOK_ID,
                volumeIndex: 1,
                chapterIndex: 1,
                pressureLevel: 'high',
                dominantTension: 'mystery',
              },
            ],
          }),
        },
        chapterTensionBudgets: { upsertMany: upsertManyBudgets },
      });

      await aggregate.generateFromIdea(bookId);

      expect(upsertManyBudgets).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ pressureLevel: 'high' }),
        ])
      );
    });

    it('saves thread actions, character pressures, and relationship actions per chapter card', async () => {
      const upsertThreadActions = vi.fn();
      const upsertCharacterPressures = vi.fn();
      const upsertRelationshipActions = vi.fn();

      const { aggregate, bookId } = createDefaultSetup({
        outlineService: {
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World',
            masterOutline: 'Outline',
            volumeOutlines: [],
            chapterOutlines: [],
            chapterCards: [
              {
                bookId: BOOK_ID,
                volumeIndex: 1,
                chapterIndex: 1,
                title: 'Chapter 1',
                plotFunction: 'Opening',
                povCharacterId: null,
                externalConflict: 'External',
                internalConflict: 'Internal',
                relationshipChange: 'Change',
                mustChange: 'Must change',
                readerReward: 'truth',
                endingHook: 'Hook',
              },
            ],
            chapterThreadActions: [
              { volumeIndex: 1, chapterIndex: 1, threadId: 't1', action: 'open', requiredEffect: 'Plant clue' },
            ],
            chapterCharacterPressures: [
              { volumeIndex: 1, chapterIndex: 1, characterId: 'c1', desirePressure: 'Want truth', fearPressure: 'Fear discovery', flawTrigger: 'Impulsiveness', expectedChoice: 'investigate' },
            ],
            chapterRelationshipActions: [
              { volumeIndex: 1, chapterIndex: 1, relationshipId: 'r1', action: 'strain', requiredChange: 'Trust breaks' },
            ],
          }),
        },
        chapterCards: {
          upsertMany: vi.fn(),
          upsertThreadActions,
          upsertCharacterPressures,
          upsertRelationshipActions,
        } as any,
      });

      await aggregate.generateFromIdea(bookId);

      expect(upsertThreadActions).toHaveBeenCalledWith(
        bookId, 1, 1,
        [expect.objectContaining({ threadId: 't1' })]
      );
      expect(upsertCharacterPressures).toHaveBeenCalledWith(
        bookId, 1, 1,
        [expect.objectContaining({ characterId: 'c1' })]
      );
      expect(upsertRelationshipActions).toHaveBeenCalledWith(
        bookId, 1, 1,
        [expect.objectContaining({ relationshipId: 'r1' })]
      );
    });

    it('tracks progress through phases', async () => {
      const { aggregate, bookId, onGenerationEvent, progress } = createDefaultSetup({
        outlineService: {
          generateFromIdea: vi.fn().mockImplementation(async (input) => {
            input.onWorldSetting?.('World setting');
            input.onMasterOutline?.('Master outline');
            return {
              worldSetting: 'World setting',
              masterOutline: 'Master outline',
              volumeOutlines: [],
              chapterOutlines: [],
            };
          }),
        },
      });

      await aggregate.generateFromIdea(bookId);

      const finalProgress = progress.getByBookId(bookId);
      expect(finalProgress?.phase).toBe('building_outline');

      const phases = onGenerationEvent.mock.calls.map((call: any) => call[0].phase);
      expect(phases).toContain('building_world');
      expect(phases).toContain('building_outline');
      expect(phases).toContain('planning_chapters');
    });

    it('emits progress events for title generation phase', async () => {
      const { aggregate, bookId, onGenerationEvent } = createDefaultSetup({
        outlineService: {
          generateTitleFromIdea: vi.fn().mockResolvedValue('Generated Title'),
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World',
            masterOutline: 'Outline',
            volumeOutlines: [],
            chapterOutlines: [],
          }),
        },
      });

      await aggregate.generateFromIdea(bookId);

      const phases = onGenerationEvent.mock.calls.map((call: any) => call[0].phase);
      expect(phases).toContain('naming_title');
    });

    it('returns early when book is deleted during title generation', async () => {
      const { aggregate, bookId, generateFromIdea } = createDeletionTestSetup({
        deleteAfterTitle: true,
      });

      await aggregate.generateFromIdea(bookId);

      // generateFromIdea should NOT be called since book was deleted after title gen
      expect(generateFromIdea).not.toHaveBeenCalled();
    });

    it('returns early when book is deleted during outline generation', async () => {
      const { aggregate, bookId, saveGraph } = createDeletionTestSetup({
        deleteAfterGeneration: true,
      });

      await aggregate.generateFromIdea(bookId);

      // saveGraph should NOT be called since book was deleted after generation
      expect(saveGraph).not.toHaveBeenCalled();
    });

    it('skips onWorldSetting callback when book is deleted mid-generation', async () => {
      const { aggregate, bookId, onGenerationEvent } = createDeletionTestSetup({
        deleteBeforeWorldSetting: true,
      });

      await aggregate.generateFromIdea(bookId);

      // The building_outline phase should NOT be emitted since the callback returned early
      const phases = onGenerationEvent.mock.calls.map((call: any) => call[0].phase);
      expect(phases).not.toContain('building_outline');
    });

    it('skips onMasterOutline callback when book is deleted mid-generation', async () => {
      const { aggregate, bookId, onGenerationEvent } = createDeletionTestSetup({
        deleteBeforeMasterOutline: true,
      });

      await aggregate.generateFromIdea(bookId);

      // The planning_chapters phase should NOT be emitted since the callback returned early
      const phases = onGenerationEvent.mock.calls.map((call: any) => call[0].phase);
      expect(phases).not.toContain('planning_chapters');
    });

    it('skips onChapterOutlines callback when book is deleted', async () => {
      const { aggregate, bookId, chapters } = createDeletionTestSetup({
        deleteBeforeChapterOutlines: true,
      });

      await aggregate.generateFromIdea(bookId);

      // No chapters should have been saved since book was deleted before onChapterOutlines callback
      const chapterList = chapters.listByBook(bookId);
      expect(chapterList).toHaveLength(0);
    });

    it('normalizes chapter outlines to target count', async () => {
      const { aggregate, bookId, chapters } = createDefaultSetup({
        targetChapters: 3,
        outlineService: {
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World',
            masterOutline: 'Outline',
            volumeOutlines: [],
            chapterOutlines: [
              { volumeIndex: 1, chapterIndex: 1, title: 'Chapter 1', outline: 'Opening' },
            ],
          }),
        },
      });

      await aggregate.generateFromIdea(bookId);

      const chapterList = chapters.listByBook(bookId);
      expect(chapterList).toHaveLength(3);
      expect(chapterList.map((c: any) => c.chapterIndex)).toEqual([1, 2, 3]);
    });

    it('passes viral strategy to outline service', async () => {
      const generateFromIdea = vi.fn().mockResolvedValue({
        worldSetting: 'World',
        masterOutline: 'Outline',
        volumeOutlines: [],
        chapterOutlines: [],
      });

      const { aggregate, bookId } = createDefaultSetup({
        viralStrategy: { targetEmotion: 'revenge', readerPromise: 'Epic revenge arc' },
        outlineService: { generateFromIdea },
      });

      await aggregate.generateFromIdea(bookId);

      expect(generateFromIdea).toHaveBeenCalledWith(
        expect.objectContaining({
          viralStrategy: expect.objectContaining({ targetEmotion: 'revenge' }),
        })
      );
    });

    it('does not call optional post-generation saves when bundle lacks data', async () => {
      const saveGraph = vi.fn();
      const upsertManyPlans = vi.fn();
      const upsertManyCards = vi.fn();
      const upsertManyBudgets = vi.fn();

      const { aggregate, bookId } = createDefaultSetup({
        outlineService: {
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World',
            masterOutline: 'Outline',
            volumeOutlines: [],
            chapterOutlines: [],
          }),
        },
        storyBibles: { saveGraph },
        volumePlans: { upsertMany: upsertManyPlans },
        chapterCards: { upsertMany: upsertManyCards } as any,
        chapterTensionBudgets: { upsertMany: upsertManyBudgets },
      });

      await aggregate.generateFromIdea(bookId);

      expect(saveGraph).not.toHaveBeenCalled();
      expect(upsertManyPlans).not.toHaveBeenCalled();
      expect(upsertManyCards).not.toHaveBeenCalled();
      expect(upsertManyBudgets).not.toHaveBeenCalled();
    });

    it('does not save empty chapter tension budgets', async () => {
      const upsertManyBudgets = vi.fn();
      const { aggregate, bookId } = createDefaultSetup({
        outlineService: {
          generateFromIdea: vi.fn().mockResolvedValue({
            worldSetting: 'World',
            masterOutline: 'Outline',
            volumeOutlines: [],
            chapterOutlines: [],
            chapterTensionBudgets: [],
          }),
        },
        chapterTensionBudgets: { upsertMany: upsertManyBudgets },
      });

      await aggregate.generateFromIdea(bookId);

      expect(upsertManyBudgets).not.toHaveBeenCalled();
    });
  });
});
