import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../../src/storage/database';
import { createBookRepository } from '../../src/storage/books';
import { createChapterAuditRepository } from '../../src/storage/chapter-audits';
import { createChapterCardRepository } from '../../src/storage/chapter-cards';
import { createChapterPlanRepository } from '../../src/storage/chapter-plans';
import { createChapterRepository } from '../../src/storage/chapters';
import { createCharacterRepository } from '../../src/storage/characters';
import { createPlotThreadRepository } from '../../src/storage/plot-threads';
import { createProgressRepository } from '../../src/storage/progress';
import { createSceneRecordRepository } from '../../src/storage/scene-records';
import { createBookService } from '../../src/core/book-service';
import { buildIntegrityReport } from '../../src/core/narrative/integrity';
import { countStoryCharacters } from '../../src/core/story-constraints';
import type { BookGenerationEvent } from '../../src/shared/contracts';

describe('createBookService', () => {
  it('creates and lists books from persisted storage', () => {
    const db = createDatabase(':memory:');
    const resolveModelId = vi.fn().mockReturnValue('openai:gpt-4o-mini');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn(),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      resolveModelId,
    });

    const bookId = service.createBook({
      idea: 'A city remembers every promise.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    const books = service.listBooks();

    expect(bookId).toBeTruthy();
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

  it('lists books with chapter completion progress without loading full detail', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const chapters = createChapterRepository(db);
    const service = createBookService({
      books,
      chapters,
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn(),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
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

    expect(service.listBooks()[0]).toMatchObject({
      id: bookId,
      progress: 50,
      completedChapters: 1,
      totalChapters: 2,
    });
  });

  it('uses batched chapter progress when listing books', () => {
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
      clearGeneratedContent: vi.fn(),
      deleteByBook: vi.fn(),
    };
    const service = createBookService({
      books: {
        create: vi.fn(),
        list: vi.fn(() => [
          {
            id: 'book-1',
            title: 'Book 1',
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
        updateTitle: vi.fn(),
        delete: vi.fn(),
        saveContext: vi.fn(),
        getContext: vi.fn(),
      },
      chapters,
      characters: {
        saveState: vi.fn(),
        listLatestStatesByBook: vi.fn(() => []),
        clearStatesByBook: vi.fn(),
        deleteByBook: vi.fn(),
      },
      plotThreads: {
        upsertThread: vi.fn(),
        resolveThread: vi.fn(),
        listByBook: vi.fn(() => []),
        clearByBook: vi.fn(),
      },
      sceneRecords: {
        save: vi.fn(),
        getLatestByBook: vi.fn(() => null),
        clearByBook: vi.fn(),
      },
      progress: {
        updatePhase: vi.fn(),
        getByBookId: vi.fn(),
        reset: vi.fn(),
        deleteByBook: vi.fn(),
      },
      outlineService: {
        generateFromIdea: vi.fn(),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    expect(service.listBooks()).toEqual([
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

  it('rejects invalid chapter and word-count limits before persistence', () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn(),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    expect(() =>
      service.createBook({
        idea: 'The moon taxes miracles.',
        targetChapters: 0,
        wordsPerChapter: 2500,
      })
    ).toThrow('Target chapters must be a positive integer');
    expect(() =>
      service.createBook({
        idea: 'The moon taxes miracles.',
        targetChapters: 500,
        wordsPerChapter: 0,
      })
    ).toThrow('Words per chapter must be a positive integer');
    expect(service.listBooks()).toHaveLength(0);
  });

  it('returns book detail with persisted context and chapter outlines after start', async () => {
    const db = createDatabase(':memory:');
    const resolveModelId = vi.fn().mockReturnValue('openai:gpt-4o-mini');
    const onBookUpdated = vi.fn();
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateTitleFromIdea: vi.fn().mockResolvedValue('月税奇谈'),
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      resolveModelId,
      onBookUpdated,
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    const detail = service.getBookDetail(bookId);

    expect(resolveModelId).toHaveBeenCalled();
    expect(onBookUpdated).toHaveBeenCalledWith(bookId);
    expect(detail?.book.title).toBe('月税奇谈');
    expect(detail?.book.status).toBe('building_outline');
    expect(detail?.context?.worldSetting).toBe('World rules');
    expect(detail?.chapters).toEqual([
      expect.objectContaining({
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
        outline: 'Opening conflict',
      }),
    ]);
    expect(detail?.progress?.phase).toBe('building_outline');
  });

  it('surfaces runtime contract, ledger, checkpoint, and run-state data on book detail narrative', () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      bookContracts: {
        getByBook: vi.fn((bookId: string) => ({
          bookId,
          titlePromise: 'A ledger of erased names must be restored.',
          corePremise: 'A clerk fights a system that edits people out of history.',
          mainlinePromise: 'Each breakthrough reveals a larger institutional cover-up.',
          protagonistCoreDesire: 'Restore her family name.',
          protagonistNoDriftRules: ['She cannot abandon the erased families.'],
          keyCharacterBoundaries: [
            {
              characterId: 'clerk-1',
              publicPersona: 'Obedient archive clerk',
              hiddenDrive: 'Expose the forgery ring',
              lineWillNotCross: 'She will not forge innocent records.',
              lineMayEventuallyCross: 'She may destroy sanctioned records.',
            },
          ],
          mandatoryPayoffs: ['Reveal who authorized the erasures.'],
          antiDriftRules: ['Every victory must deepen the institutional risk.'],
          activeTemplate: 'mystery_serial' as const,
          createdAt: '2026-05-03T08:00:00.000Z',
          updatedAt: '2026-05-03T08:30:00.000Z',
        })),
      },
      storyLedgers: {
        getLatestByBook: vi.fn((bookId: string) => ({
          bookId,
          chapterIndex: 7,
          mainlineProgress: 'The clerk links the erased names to a magistrate.',
          activeSubplots: [{ id: 'subplot-1', status: 'open' }],
          openPromises: [{ id: 'promise-1', targetChapter: 9 }],
          characterTruths: [{ characterId: 'clerk-1', truth: 'Her mentor lied.' }],
          relationshipDeltas: [{ relationshipId: 'mentor', direction: 'worse' }],
          worldFacts: [{ factId: 'seal', fact: 'The archive seal can be cloned.' }],
          rhythmPosition: 'twist',
          riskFlags: [{ code: 'promise_gap', severity: 'major' }],
          createdAt: '2026-05-03T08:45:00.000Z',
        })),
      },
      storyCheckpoints: {
        getLatestByBook: vi.fn((bookId: string) => ({
          bookId,
          chapterIndex: 6,
          checkpointType: 'heavy',
          createdAt: '2026-05-03T08:15:00.000Z',
        })),
      },
      outlineService: {
        generateFromIdea: vi.fn(),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'A clerk restores erased family names.',
      targetChapters: 12,
      wordsPerChapter: 1800,
    });

    service.pauseBook(bookId);
    const detail = service.getBookDetail(bookId);

    expect(detail?.narrative).toEqual(
      expect.objectContaining({
        bookContract: expect.objectContaining({
          bookId,
          activeTemplate: 'mystery_serial',
        }),
        latestLedger: expect.objectContaining({
          bookId,
          chapterIndex: 7,
          rhythmPosition: 'twist',
        }),
        latestCheckpoint: expect.objectContaining({
          bookId,
          chapterIndex: 6,
          checkpointType: 'heavy',
        }),
        runState: expect.objectContaining({
          phase: 'paused',
          currentChapter: null,
          driftLevel: 'none',
          starvationScore: 0,
          lastHealthyCheckpointChapter: null,
          latestFailureReason: null,
          cooldownUntil: null,
        }),
      })
    );
    expect(detail?.progress).toEqual(
      expect.objectContaining({
        phase: 'paused',
      })
    );
  });

  it('persists the target number of chapter outlines even when generated chapter indexes repeat', async () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Duplicate 1',
              outline: 'Opening conflict',
            },
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Duplicate 2',
              outline: 'Escalation',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 2,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);

    const detail = service.getBookDetail(bookId);

    expect(detail?.chapters).toHaveLength(2);
    expect(detail?.chapters.map((chapter) => chapter.chapterIndex)).toEqual([
      1, 2,
    ]);
  });

  it('fills missing generated chapter outlines before persistence', async () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 3,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);

    const detail = service.getBookDetail(bookId);

    expect(detail?.chapters).toHaveLength(3);
    expect(detail?.chapters.map((chapter) => chapter.chapterIndex)).toEqual([
      1, 2, 3,
    ]);
  });

  it('marks the book as generating a title before asking the title model', async () => {
    const db = createDatabase(':memory:');
    let service!: ReturnType<typeof createBookService>;
    let bookId = '';

    service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateTitleFromIdea: vi.fn(async () => {
          expect(service.getBookDetail(bookId)?.progress?.phase).toBe(
            'naming_title'
          );
          return '月税奇谈';
        }),
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: [],
          chapterOutlines: [],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
  });

  it('persists world setting and master outline while outline generation is still running', async () => {
    const db = createDatabase(':memory:');
    const resolveModelId = vi.fn().mockReturnValue('openai:gpt-4o-mini');
    const onBookUpdated = vi.fn();
    let service!: ReturnType<typeof createBookService>;
    let bookId = '';

    service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn(async (input) => {
          input.onWorldSetting?.('Early world rules');

          expect(service.getBookDetail(bookId)?.context).toMatchObject({
            worldSetting: 'Early world rules',
            outline: '',
          });
          expect(service.getBookDetail(bookId)?.progress?.phase).toBe(
            'building_outline'
          );
          expect(onBookUpdated).toHaveBeenCalledWith(bookId);

          input.onMasterOutline?.('Early master outline');

          expect(service.getBookDetail(bookId)?.context).toMatchObject({
            worldSetting: 'Early world rules',
            outline: 'Early master outline',
          });
          expect(service.getBookDetail(bookId)?.progress?.phase).toBe(
            'planning_chapters'
          );
          expect(service.getBookDetail(bookId)?.progress).toEqual(
            expect.objectContaining({
              currentStage: null,
              currentArc: null,
              activeTaskType: null,
            })
          );

          return {
            worldSetting: 'Early world rules',
            masterOutline: 'Early master outline',
            volumeOutlines: [],
            chapterOutlines: [],
          };
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      resolveModelId,
      onBookUpdated,
    });

    bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);

    expect(onBookUpdated).toHaveBeenCalledTimes(6);
  });

  it('persists chapter outlines while outline generation is still running', async () => {
    const db = createDatabase(':memory:');
    const resolveModelId = vi.fn().mockReturnValue('openai:gpt-4o-mini');
    const onBookUpdated = vi.fn();
    let service!: ReturnType<typeof createBookService>;
    let bookId = '';

    service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn(async (input) => {
          input.onChapterOutlines?.([
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: '早来的第一章',
              outline: 'Opening conflict',
            },
          ]);

          expect(service.getBookDetail(bookId)?.chapters).toEqual([
            expect.objectContaining({
              volumeIndex: 1,
              chapterIndex: 1,
              title: '早来的第一章',
              outline: 'Opening conflict',
            }),
          ]);
          expect(onBookUpdated).toHaveBeenCalledWith(bookId);

          return {
            worldSetting: 'World rules',
            masterOutline: 'Master outline',
            volumeOutlines: ['Volume 1'],
            chapterOutlines: [
              {
                volumeIndex: 1,
                chapterIndex: 1,
                title: '早来的第一章',
                outline: 'Opening conflict',
              },
            ],
          };
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      resolveModelId,
      onBookUpdated,
    });

    bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
  });

  it('pauses a started book and persists the paused phase', async () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 2,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    service.pauseBook(bookId);

    const detail = service.getBookDetail(bookId);

    expect(detail?.book.status).toBe('paused');
    expect(detail?.progress?.phase).toBe('paused');
  });

  it('writes the next outlined chapter and persists the generated content', async () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: 'Generated chapter content',
          usage: {
            inputTokens: 100,
            outputTokens: 400,
          },
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Chapter summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [
            {
              id: 'thread-1',
              description: 'A hidden debt resurfaces later',
              plantedAt: 1,
              expectedPayoff: 6,
              importance: 'critical',
            },
          ],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([
          {
            characterId: 'protagonist',
            characterName: 'Lin Mo',
            location: 'Rain Market',
            status: 'Investigating the debt ledger',
            knowledge: 'Knows the ledger is forged',
            emotion: 'Suspicious',
            powerLevel: 'Awakened',
          },
        ]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue({
          location: 'Rain Market',
          timeInStory: 'Night',
          charactersPresent: ['Lin Mo'],
          events: 'Lin Mo discovers the forged ledger',
        }),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);
    const detail = service.getBookDetail(bookId);

    expect(detail?.book.status).toBe('writing');
    expect(detail?.progress?.phase).toBe('writing');
    expect(detail?.plotThreads).toEqual([
      expect.objectContaining({
        id: 'thread-1',
        description: 'A hidden debt resurfaces later',
        plantedAt: 1,
        expectedPayoff: 6,
        importance: 'critical',
      }),
    ]);
    expect(detail?.characterStates).toEqual([
      expect.objectContaining({
        characterName: 'Lin Mo',
        location: 'Rain Market',
        status: 'Investigating the debt ledger',
      }),
    ]);
    expect(detail?.latestScene).toEqual(
      expect.objectContaining({
        location: 'Rain Market',
        timeInStory: 'Night',
        events: 'Lin Mo discovers the forged ledger',
      })
    );
    expect(detail?.chapters[0]).toEqual(
      expect.objectContaining({
        title: 'Chapter 1',
        content: 'Generated chapter content',
        summary: 'Chapter summary',
      })
    );
  });

  it('notifies listeners after chapter content is persisted', async () => {
    const db = createDatabase(':memory:');
    const onBookUpdated = vi.fn();
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: 'Generated chapter content',
          usage: { inputTokens: 100, outputTokens: 400 },
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Chapter summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      onBookUpdated,
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    onBookUpdated.mockClear();
    await service.writeNextChapter(bookId);

    expect(onBookUpdated).toHaveBeenCalledWith(bookId);
    expect(service.getBookDetail(bookId)?.chapters[0]?.content).toBe(
      'Generated chapter content'
    );
  });

  it('injects story route plans into chapter writing and auditing', async () => {
    const db = createDatabase(':memory:');
    const savedBibles: Record<string, any> = {};
    const savedCards: any[] = [];
    const savedBudgets: any[] = [];
    const writeChapter = vi.fn().mockResolvedValue({
      content: '第一章正文',
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    const auditChapter = vi.fn().mockResolvedValue({
      passed: true,
      score: 90,
      decision: 'accept',
      issues: [],
      scoring: {
        characterLogic: 18,
        mainlineProgress: 14,
        relationshipChange: 12,
        conflictDepth: 14,
        worldRuleCost: 8,
        threadManagement: 8,
        pacingReward: 10,
        themeAlignment: 6,
        viral: {
          openingHook: 90,
          desireClarity: 90,
          payoffStrength: 90,
          readerQuestionStrength: 90,
          tropeFulfillment: 90,
          antiClicheFreshness: 90,
        },
        flatness: {
          conflictEscalation: 80,
          choicePressure: 80,
          consequenceVisibility: 80,
          irreversibleChange: 80,
          hookStrength: 80,
        },
      },
      stateUpdates: {
        characterArcUpdates: [],
        relationshipUpdates: [],
        threadUpdates: [],
        worldRuleUpdates: [],
      },
    });
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
          narrativeBible: {
            premise: '修复命簿的人发现家族被删除。',
            genreContract: '悬疑升级。',
            targetReaderExperience: '追问真相。',
            themeQuestion: '自由是否需要代价？',
            themeAnswerDirection: '自由需要承担代价。',
            centralDramaticQuestion: '林牧能否夺回命运？',
            endingState: {
              protagonistWins: '夺回选择权。',
              protagonistLoses: '失去旧身份。',
              worldChange: '命簿规则公开。',
              relationshipOutcome: '同伴仍愿同行。',
              themeAnswer: '自由来自承担。',
            },
            voiceGuide: '冷静、具象、克制。',
            characterArcs: [],
            relationshipEdges: [],
            worldRules: [],
            narrativeThreads: [],
            viralStoryProtocol: {
              readerPromise: '压抑后翻盘。',
              targetEmotion: 'revenge',
              coreDesire: '洗清旧案。',
              protagonistDrive: '证据逼迫林牧主动行动。',
              hookEngine: '旧案证据逐层指向宗门高层。',
              payoffCadence: {
                mode: 'steady',
                minorPayoffEveryChapters: 2,
                majorPayoffEveryChapters: 8,
                payoffTypes: ['truth_reveal'],
              },
              tropeContract: ['revenge_payback'],
              antiClicheRules: ['反击必须付出代价。'],
              longTermQuestion: '谁改写了命簿？',
            },
          },
          chapterCards: [
            {
              bookId: '',
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              plotFunction: '开局异常。',
              povCharacterId: null,
              externalConflict: '旧页出现。',
              internalConflict: '是否相信旧页。',
              relationshipChange: '向同伴隐瞒。',
              worldRuleUsedOrTested: '改写有代价。',
              informationReveal: '家族记录消失。',
              readerReward: 'truth',
              endingHook: '旧页写出新名字。',
              mustChange: '林牧决定追查。',
              forbiddenMoves: ['不能无代价改写命簿。'],
            },
          ],
          chapterTensionBudgets: [
            {
              bookId: '',
              volumeIndex: 1,
              chapterIndex: 1,
              pressureLevel: 'high',
              dominantTension: 'mystery',
              requiredTurn: '旧页回应林牧。',
              forcedChoice: '保密或求助。',
              costToPay: '失去一段记忆。',
              irreversibleChange: '林牧开始追查。',
              readerQuestion: '旧页为何回应？',
              hookPressure: '章末出现新名字。',
              flatnessRisks: ['不要只解释。'],
            },
          ],
        }),
      },
      storyBibles: {
        saveGraph: (bookId, bible) => {
          savedBibles[bookId] = bible;
        },
        getByBook: (bookId) => savedBibles[bookId] ?? null,
      },
      chapterCards: {
        upsertMany: (cards) => {
          savedCards.push(...cards);
        },
        listByBook: () => savedCards,
        listCharacterPressures: () => [],
        listRelationshipActions: () => [],
        listThreadActions: () => [],
      },
      chapterTensionBudgets: {
        upsertMany: (budgets) => {
          savedBudgets.push(...budgets);
        },
        getByChapter: (_bookId, volumeIndex, chapterIndex) =>
          savedBudgets.find(
            (budget) =>
              budget.volumeIndex === volumeIndex &&
              budget.chapterIndex === chapterIndex
          ) ?? null,
      },
      worldRules: {
        listByBook: () => [],
      },
      chapterWriter: { writeChapter },
      chapterAuditor: { auditChapter },
      chapterAudits: createChapterAuditRepository(db),
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('摘要'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      resolveModelId: vi.fn().mockReturnValue('openai:gpt-4o-mini'),
    });

    const bookId = service.createBook({
      idea: '命簿',
      targetChapters: 1,
      wordsPerChapter: 1200,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    expect(writeChapter.mock.calls[0]?.[0].prompt).toContain(
      'Story Skill Route Plan'
    );
    expect(writeChapter.mock.calls[0]?.[0].prompt).toContain('chapter-goal');
    expect(writeChapter.mock.calls[0]?.[0].prompt).toContain(
      'Viral Story Protocol'
    );
    expect(auditChapter).toHaveBeenCalledWith(
      expect.objectContaining({
        routePlanText: expect.stringContaining('Story Skill Route Plan'),
        viralStoryProtocol: expect.objectContaining({
          readerPromise: '压抑后翻盘。',
        }),
      })
    );
    const detail = service.getBookDetail(bookId);
    expect(detail?.narrative?.storyBible?.viralStoryProtocol).toMatchObject({
      readerPromise: '压抑后翻盘。',
    });
    expect(detail?.chapters[0]).toMatchObject({
      auditViralScore: 90,
    });
  });

  it('returns story route plans on chapter detail records', async () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: { writeChapter: vi.fn() },
      summaryGenerator: { summarizeChapter: vi.fn() },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
      sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
    });

    const bookId = service.createBook({
      idea: '命簿',
      targetChapters: 1,
      wordsPerChapter: 1200,
    });

    await service.startBook(bookId);
    const detail = service.getBookDetail(bookId);

    expect(detail?.chapters[0]?.storyRoutePlan).toMatchObject({
      taskType: 'write_chapter',
    });
    expect(
      detail?.chapters[0]?.storyRoutePlan?.requiredSkills.map((skill) => skill.id)
    ).toContain('chapter-goal');
  });

  it('injects story route plans into legacy chapter prompts without chapter cards', async () => {
    const db = createDatabase(':memory:');
    const writeChapter = vi.fn().mockResolvedValue({
      content: 'Generated chapter content',
      usage: { inputTokens: 100, outputTokens: 400 },
    });
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter,
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Chapter summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    expect(writeChapter.mock.calls[0]?.[0].prompt).toContain(
      'Story Skill Route Plan'
    );
    expect(writeChapter.mock.calls[0]?.[0].prompt).toContain('Chapter Card missing');
  });

  it('emits generation progress, stream chunks, and completion for the next chapter', async () => {
    const db = createDatabase(':memory:');
    const events: BookGenerationEvent[] = [];
    const writeChapter = vi.fn().mockImplementation(
      async ({
        onChunk,
      }: {
        onChunk?: (chunk: string) => void;
      }) => {
        onChunk?.('第一段');
        onChunk?.('第二段');

        return {
          content: '第一段第二段',
          usage: { inputTokens: 100, outputTokens: 400 },
        };
      }
    );
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter,
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Chapter summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      onGenerationEvent: (event) => {
        events.push(event);
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    events.splice(0, events.length);
    await service.writeNextChapter(bookId);

    expect(writeChapter).toHaveBeenCalledWith(
      expect.objectContaining({
        onChunk: expect.any(Function),
      })
    );
    expect(events).toEqual([
      {
        bookId,
        type: 'progress',
        phase: 'writing',
        stepLabel: '正在写第 1 章',
        currentVolume: 1,
        currentChapter: 1,
      },
      {
        bookId,
        type: 'chapter-stream',
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
        delta: '第一段',
      },
      {
        bookId,
        type: 'chapter-stream',
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
        delta: '第二段',
      },
      {
        bookId,
        type: 'progress',
        phase: 'extracting_continuity',
        stepLabel: '正在生成第 1 章摘要与连续性',
        currentVolume: 1,
        currentChapter: 1,
      },
      {
        bookId,
        type: 'chapter-complete',
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
      },
    ]);
    expect(service.getBookDetail(bookId)?.progress).toEqual(
      expect.objectContaining({
        currentVolume: 1,
        currentChapter: 1,
        phase: 'writing',
        stepLabel: '正在生成第 1 章摘要与连续性',
      })
    );
  });

  it('stops emitting generation events after a book is paused while the current chapter is in flight', async () => {
    const db = createDatabase(':memory:');
    const events: BookGenerationEvent[] = [];
    let resolveWriteChapter!: (result: {
      content: string;
      usage: { inputTokens: number; outputTokens: number };
    }) => void;
    const writeChapter = vi.fn().mockImplementation(
      () =>
        new Promise<{
          content: string;
          usage: { inputTokens: number; outputTokens: number };
        }>((resolve) => {
          resolveWriteChapter = resolve;
        })
    );
    const summaryGenerator = vi.fn().mockResolvedValue('Chapter summary');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter,
      },
      summaryGenerator: {
        summarizeChapter: summaryGenerator,
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      onGenerationEvent: (event) => {
        events.push(event);
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    events.splice(0, events.length);
    const writePromise = service.writeNextChapter(bookId);

    expect(events).toEqual([
      {
        bookId,
        type: 'progress',
        phase: 'writing',
        stepLabel: '正在写第 1 章',
        currentVolume: 1,
        currentChapter: 1,
      },
    ]);

    service.pauseBook(bookId);
    resolveWriteChapter({
      content: 'Generated chapter content',
      usage: { inputTokens: 100, outputTokens: 300 },
    });
    await writePromise;

    expect(events).toEqual([
      {
        bookId,
        type: 'progress',
        phase: 'writing',
        stepLabel: '正在写第 1 章',
        currentVolume: 1,
        currentChapter: 1,
      },
    ]);
    expect(summaryGenerator).not.toHaveBeenCalled();
    expect(service.getBookDetail(bookId)?.progress).toEqual(
      expect.objectContaining({
        phase: 'paused',
        stepLabel: null,
      })
    );
    expect(service.getBookDetail(bookId)?.chapters[0]?.content).toBeNull();
  });

  it('exposes dual-loop progress metadata in book detail', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const progress = createProgressRepository(db);
    const service = createBookService({
      books,
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress,
      outlineService: {
        generateFromIdea: vi.fn(),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    books.create({
      id: 'book-1',
      title: 'Book 1',
      idea: 'A city remembers every promise.',
      targetChapters: 24,
      wordsPerChapter: 2500,
    });

    progress.updatePhase('book-1', 'planning_arc', {
      currentChapter: 10,
      stepLabel: '重建 11-20 章计划',
      activeTaskType: 'book:plan:rebuild-chapters',
      currentStage: 1,
      currentArc: 1,
    });

    expect(service.getBookDetail('book-1')?.progress).toEqual(
      expect.objectContaining({
        phase: 'planning_arc',
        currentChapter: 10,
        stepLabel: '重建 11-20 章计划',
        activeTaskType: 'book:plan:rebuild-chapters',
        currentStage: 1,
        currentArc: 1,
      })
    );
  });

  it('exposes typed planning task metadata from persisted progress records', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const progress = createProgressRepository(db);
    const service = createBookService({
      books,
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress,
      outlineService: {
        generateFromIdea: vi.fn(),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    books.create({
      id: 'book-1',
      title: 'Book 1',
      idea: 'A city remembers every promise.',
      targetChapters: 24,
      wordsPerChapter: 2500,
    });

    progress.updatePhase('book-1', 'planning_chapters', {
      currentChapter: 10,
      stepLabel: '重建 11-20 章计划',
      activeTaskType: 'book:plan:rebuild-chapters',
      currentStage: 1,
      currentArc: 2,
    });
    expect(service.getBookDetail('book-1')?.progress).toEqual(
      expect.objectContaining({
        phase: 'planning_chapters',
        currentChapter: 10,
        stepLabel: '重建 11-20 章计划',
        activeTaskType: 'book:plan:rebuild-chapters',
        currentStage: 1,
        currentArc: 2,
      })
    );
  });

  it('persists autopilot run-state metadata in progress records', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const progress = createProgressRepository(db);

    books.create({
      id: 'book-1',
      title: 'Book 1',
      idea: 'A city remembers every promise.',
      targetChapters: 24,
      wordsPerChapter: 2500,
    });

    progress.updatePhase('book-1', 'writing', {
      driftLevel: 'medium',
      lastHealthyCheckpointChapter: 12,
      cooldownUntil: '2026-05-03T09:30:00.000Z',
      starvationScore: 4,
    });

    expect(progress.getByBookId('book-1')).toEqual(
      expect.objectContaining({
        bookId: 'book-1',
        phase: 'writing',
        driftLevel: 'medium',
        lastHealthyCheckpointChapter: 12,
        cooldownUntil: '2026-05-03T09:30:00.000Z',
        starvationScore: 4,
      })
    );

    progress.updatePhase('book-1', 'paused');

    expect(progress.getByBookId('book-1')).toEqual(
      expect.objectContaining({
        bookId: 'book-1',
        phase: 'paused',
        driftLevel: 'medium',
        lastHealthyCheckpointChapter: 12,
        cooldownUntil: '2026-05-03T09:30:00.000Z',
        starvationScore: 4,
      })
    );

    progress.reset('book-1', 'creating');

    expect(progress.getByBookId('book-1')).toEqual(
      expect.objectContaining({
        bookId: 'book-1',
        phase: 'creating',
        driftLevel: 'none',
        lastHealthyCheckpointChapter: null,
        cooldownUntil: null,
        starvationScore: 0,
      })
    );
  });

  it('normalizes sparse autopilot metadata into narrative run-state while preserving raw progress fields', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const progressRecord = {
      bookId: 'book-1',
      currentVolume: null,
      phase: 'writing',
      currentChapter: 13,
      currentStage: null,
      currentArc: null,
      stepLabel: null,
      activeTaskType: null,
      retryCount: 0,
      errorMsg: 'Checkpoint drift exceeded threshold.',
      driftLevel: undefined,
      lastHealthyCheckpointChapter: undefined,
      cooldownUntil: undefined,
      starvationScore: undefined,
    };
    const service = createBookService({
      books,
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: {
        updatePhase: vi.fn(),
        getByBookId: vi.fn(() => progressRecord as any),
        reset: vi.fn(),
        deleteByBook: vi.fn(),
      },
      outlineService: {
        generateFromIdea: vi.fn(),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    books.create({
      id: 'book-1',
      title: 'Book 1',
      idea: 'A city remembers every promise.',
      targetChapters: 24,
      wordsPerChapter: 2500,
    });

    const detail = service.getBookDetail('book-1');

    expect(detail?.progress).toBe(progressRecord);
    expect(detail?.narrative?.runState).toEqual({
      phase: 'writing',
      currentChapter: 13,
      driftLevel: 'none',
      starvationScore: 0,
      lastHealthyCheckpointChapter: null,
      latestFailureReason: 'Checkpoint drift exceeded threshold.',
      cooldownUntil: null,
    });
  });

  it('emits planning_init as a progress event when planning metadata is initialized', async () => {
    const db = createDatabase(':memory:');
    const events: BookGenerationEvent[] = [];
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [],
          stagePlans: [
            {
              stageIndex: 1,
              chapterStart: 1,
              chapterEnd: 10,
              chapterBudget: 10,
              objective: 'Start the case.',
              primaryResistance: 'Hidden censors.',
              pressureCurve: 'ascending',
              escalation: 'Allies are implicated.',
              climax: 'Truth becomes public.',
              payoff: 'The real conspiracy is exposed.',
              irreversibleChange: 'The protagonist loses cover.',
              nextQuestion: 'Who benefits next?',
              titleIdeaFocus: 'Truth costs safety.',
              compressionTrigger: 'Compress side quests if momentum stalls.',
              status: 'planned',
            },
          ],
          arcPlans: [
            {
              arcIndex: 1,
              stageIndex: 1,
              chapterStart: 1,
              chapterEnd: 5,
              chapterBudget: 5,
              primaryThreads: [],
              characterTurns: [],
              threadActions: [],
              targetOutcome: 'Commit to the investigation.',
              escalationMode: 'tightening',
              turningPoint: 'Evidence points inward.',
              requiredPayoff: 'The cost of truth is visible.',
              resultingInstability: 'No safe retreat remains.',
              titleIdeaFocus: 'Truth costs safety.',
              minChapterCount: 4,
              maxChapterCount: 6,
              status: 'planned',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      onGenerationEvent: (event) => {
        events.push(event);
      },
    });

    const bookId = service.createBook({
      idea: 'A city remembers every promise.',
      targetChapters: 10,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);

    expect(events).toContainEqual(
      expect.objectContaining({
        bookId,
        type: 'progress',
        phase: 'planning_init',
      })
    );
  });

  it('preserves generated chapter content when it exceeds the soft words-per-chapter target', async () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: '一二三四五六七八九十超出限制',
          usage: { inputTokens: 100, outputTokens: 400 },
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockImplementation(async ({ content }) => content),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 1,
      wordsPerChapter: 10,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    const chapter = service.getBookDetail(bookId)?.chapters[0];

    expect(chapter?.content).toBe('一二三四五六七八九十超出限制');
    expect(chapter?.wordCount).toBe(14);
    expect(chapter?.summary).toBe('一二三四五六七八九十超出限制');
  });

  it('rewrites a short chapter once when automatic review requests it', async () => {
    const db = createDatabase(':memory:');
    const writeChapter = vi
      .fn()
      .mockResolvedValueOnce({
        content: '太短',
        usage: { inputTokens: 100, outputTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '第二稿补足了场景、冲突和情绪推进。',
        usage: { inputTokens: 140, outputTokens: 120 },
      });
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter,
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockImplementation(async ({ content }) => content),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      shouldRewriteShortChapter: ({ content }) => content === '太短',
      resolveModelId: () => 'openai:gpt-4o-mini',
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 1,
      wordsPerChapter: 20,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    const chapter = service.getBookDetail(bookId)?.chapters[0];

    expect(writeChapter).toHaveBeenCalledTimes(2);
    expect(writeChapter.mock.calls[1]?.[0].prompt).toContain(
      'Automatic review found this chapter too short'
    );
    expect(writeChapter.mock.calls[1]?.[0].prompt).toContain(
      'Start over from the original chapter brief'
    );
    expect(writeChapter.mock.calls[1]?.[0].prompt).not.toContain('Previous draft');
    expect(writeChapter.mock.calls[1]?.[0].prompt).not.toContain('太短');
    expect(chapter?.content).toBe('第二稿补足了场景、冲突和情绪推进。');
    expect(chapter?.summary).toBe('第二稿补足了场景、冲突和情绪推进。');
  });

  it('does not commit a chapter when integrity requests rebuilding the chapter window', async () => {
    const db = createDatabase(':memory:');
    const chapters = createChapterRepository(db);
    const saveContentSpy = vi.spyOn(chapters, 'saveContent');
    const progress = createProgressRepository(db);
    const service = createBookService({
      books: createBookRepository(db),
      chapters,
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress,
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: 'Generated chapter content',
          usage: { inputTokens: 100, outputTokens: 300 },
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Chapter summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      chapterIntegrityChecker: {
        inspectChapter: vi.fn().mockResolvedValue(
          buildIntegrityReport({
            mainlineProblems: ['Mainline goal regressed.'],
            payoffProblems: ['Setup payoff timing slipped.'],
          })
        ),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    expect(saveContentSpy).not.toHaveBeenCalled();
    expect(service.getBookDetail(bookId)?.chapters[0]).toEqual(
      expect.objectContaining({
        title: 'Chapter 1',
        content: null,
        summary: null,
      })
    );
    expect(progress.getByBookId(bookId)).toEqual(
      expect.objectContaining({
        phase: 'planning_recheck',
        currentChapter: 1,
        activeTaskType: 'book:plan:rebuild-chapters',
      })
    );
  });

  it('skips short-chapter rewrite when using a mock model id', async () => {
    const db = createDatabase(':memory:');
    const writeChapter = vi.fn().mockResolvedValue({
      content: '太短',
      usage: { inputTokens: 100, outputTokens: 20 },
    });
    const shouldRewriteShortChapter = vi.fn().mockReturnValue(true);
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter,
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockImplementation(async ({ content }) => content),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      shouldRewriteShortChapter,
      resolveModelId: () => 'mock:preview',
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 20,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    expect(shouldRewriteShortChapter).not.toHaveBeenCalled();
    expect(writeChapter).toHaveBeenCalledTimes(1);
    expect(service.getBookDetail(bookId)?.chapters[0]?.content).toBe('太短');
  });

  it('replaces live stream output when a short chapter rewrite starts', async () => {
    const db = createDatabase(':memory:');
    const events: BookGenerationEvent[] = [];
    const writeChapter = vi
      .fn()
      .mockImplementationOnce(async ({ onChunk }) => {
        onChunk?.('短稿');

        return {
          content: '短稿',
          usage: { inputTokens: 100, outputTokens: 20 },
        };
      })
      .mockImplementationOnce(async ({ onChunk }) => {
        onChunk?.('完整重写');
        onChunk?.('正文');

        return {
          content: '完整重写正文',
          usage: { inputTokens: 140, outputTokens: 120 },
        };
      });
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter,
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockImplementation(async ({ content }) => content),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      shouldRewriteShortChapter: ({ content }) => content === '短稿',
      onGenerationEvent: (event) => {
        events.push(event);
      },
      resolveModelId: () => 'openai:gpt-4o-mini',
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 20,
    });

    await service.startBook(bookId);
    events.splice(0, events.length);
    await service.writeNextChapter(bookId);

    expect(events).toEqual(
      expect.arrayContaining([
        {
          bookId,
          type: 'progress',
          phase: 'writing',
          stepLabel: '正在重写第 1 章',
          currentVolume: 1,
          currentChapter: 1,
        },
        {
          bookId,
          type: 'chapter-stream',
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          delta: '完整重写',
          replace: true,
        },
        {
          bookId,
          type: 'chapter-stream',
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          delta: '正文',
        },
      ])
    );
    expect(service.getBookDetail(bookId)?.chapters[0]?.content).toBe(
      '完整重写正文'
    );
  });

  it('counts chapter text by non-whitespace story characters without trimming prose', async () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: '一二三\n\n四五 六七八九',
          usage: { inputTokens: 100, outputTokens: 400 },
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockImplementation(async ({ content }) => content),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 1,
      wordsPerChapter: 5,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    const chapter = service.getBookDetail(bookId)?.chapters[0];

    expect(chapter?.content).toBe('一二三\n\n四五 六七八九');
    expect(countStoryCharacters(chapter?.content ?? '')).toBe(9);
    expect(chapter?.wordCount).toBe(9);
    expect(chapter?.summary).toBe('一二三\n\n四五 六七八九');
  });

  it('falls back to legacy post-chapter extractors when unified extraction fails', async () => {
    const db = createDatabase(':memory:');
    const chapterUpdateExtractor = vi
      .fn()
      .mockRejectedValue(new Error('invalid JSON'));
    const summarizeChapter = vi.fn().mockResolvedValue('Fallback summary');
    const extractThreads = vi.fn().mockResolvedValue({
      openedThreads: [
        {
          id: 'thread-fallback',
          description: 'Fallback thread',
          plantedAt: 1,
          expectedPayoff: 4,
          importance: 'normal',
        },
      ],
      resolvedThreadIds: [],
    });
    const extractStates = vi.fn().mockResolvedValue([
      {
        characterId: 'protagonist',
        characterName: 'Lin Mo',
        location: 'Archive Gate',
        status: 'Recovering continuity state',
        knowledge: 'Knows fallback extraction worked',
        emotion: 'Calm',
        powerLevel: 'Awakened',
      },
    ]);
    const extractScene = vi.fn().mockResolvedValue({
      location: 'Archive Gate',
      timeInStory: 'Dawn',
      charactersPresent: ['Lin Mo'],
      events: 'Fallback extractor records the scene',
    });

    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: 'Generated chapter content',
          usage: { inputTokens: 100, outputTokens: 400 },
        }),
      },
      summaryGenerator: {
        summarizeChapter,
      },
      plotThreadExtractor: {
        extractThreads,
      },
      characterStateExtractor: {
        extractStates,
      },
      sceneRecordExtractor: {
        extractScene,
      },
      chapterUpdateExtractor: {
        extractChapterUpdate: chapterUpdateExtractor,
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 2,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    const detail = service.getBookDetail(bookId);

    expect(chapterUpdateExtractor).toHaveBeenCalledTimes(1);
    expect(summarizeChapter).toHaveBeenCalledTimes(1);
    expect(extractThreads).toHaveBeenCalledTimes(1);
    expect(extractStates).toHaveBeenCalledTimes(1);
    expect(extractScene).toHaveBeenCalledTimes(1);
    expect(detail?.chapters[0]).toEqual(
      expect.objectContaining({
        content: 'Generated chapter content',
        summary: 'Fallback summary',
      })
    );
    expect(detail?.plotThreads).toEqual([
      expect.objectContaining({
        id: 'thread-fallback',
        description: 'Fallback thread',
      }),
    ]);
    expect(detail?.latestScene).toEqual(
      expect.objectContaining({
        location: 'Archive Gate',
        events: 'Fallback extractor records the scene',
      })
    );
  });

  it('falls back to legacy post-chapter extractors when unified extraction returns an empty summary', async () => {
    const db = createDatabase(':memory:');
    const chapterUpdateExtractor = vi.fn().mockResolvedValue({
      summary: '',
      openedThreads: [],
      resolvedThreadIds: [],
      characterStates: [],
      scene: null,
    });
    const summarizeChapter = vi.fn().mockResolvedValue('Recovered summary');

    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: 'Generated chapter content',
          usage: { inputTokens: 100, outputTokens: 400 },
        }),
      },
      summaryGenerator: {
        summarizeChapter,
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      chapterUpdateExtractor: {
        extractChapterUpdate: chapterUpdateExtractor,
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    const detail = service.getBookDetail(bookId);

    expect(chapterUpdateExtractor).toHaveBeenCalledTimes(1);
    expect(summarizeChapter).toHaveBeenCalledTimes(1);
    expect(detail?.chapters[0]).toEqual(
      expect.objectContaining({
        summary: 'Recovered summary',
      })
    );
  });

  it('trims oversized world and master outline context in chapter prompts', async () => {
    const db = createDatabase(':memory:');
    const writeChapter = vi.fn().mockResolvedValue({
      content: 'Generated chapter content',
      usage: { inputTokens: 100, outputTokens: 400 },
    });
    const longWorld = `World start ${'w'.repeat(9000)} World end`;
    const longMaster = `Master start ${'m'.repeat(9000)} Master end`;

    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: longWorld,
          masterOutline: longMaster,
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict must remain visible.',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter,
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Chapter summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 2,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    const prompt = writeChapter.mock.calls[0]?.[0].prompt ?? '';

    expect(prompt).toContain('World start');
    expect(prompt).toContain('Master start');
    expect(prompt).toContain('[truncated]');
    expect(prompt).not.toContain('World end');
    expect(prompt).not.toContain('Master end');
    expect(prompt).toContain('Opening conflict must remain visible.');
    expect(prompt.length).toBeLessThan(12000);
  });

  it('writes all remaining outlined chapters in order', async () => {
    const db = createDatabase(':memory:');
    const writeChapter = vi
      .fn()
      .mockResolvedValueOnce({
        content:
          'Generated chapter 1. Lin Mo pressed the debt seal into the rain-soaked stone and heard the vault answer.',
        usage: { inputTokens: 100, outputTokens: 300 },
      })
      .mockResolvedValueOnce({
        content: 'Generated chapter 2',
        usage: { inputTokens: 120, outputTokens: 320 },
      });

    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
            {
              volumeIndex: 1,
              chapterIndex: 2,
              title: 'Chapter 2',
              outline: 'Escalation',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter,
      },
      summaryGenerator: {
        summarizeChapter: vi
          .fn()
          .mockResolvedValueOnce('Summary 1')
          .mockResolvedValueOnce('Summary 2'),
      },
      plotThreadExtractor: {
        extractThreads: vi
          .fn()
          .mockResolvedValueOnce({
            openedThreads: [
              {
                id: 'thread-1',
                description: 'Debt clue',
                plantedAt: 1,
                expectedPayoff: 3,
                importance: 'normal',
              },
            ],
            resolvedThreadIds: [],
          })
          .mockResolvedValueOnce({
            openedThreads: [],
            resolvedThreadIds: ['thread-1'],
          }),
      },
      characterStateExtractor: {
        extractStates: vi
          .fn()
          .mockResolvedValueOnce([
            {
              characterId: 'protagonist',
              characterName: 'Lin Mo',
              location: 'Archive Gate',
              status: 'Opens the sealed vault',
              knowledge: 'Found the debt sigil',
              emotion: 'Determined',
              powerLevel: 'Awakened',
            },
          ])
          .mockResolvedValueOnce([
            {
              characterId: 'protagonist',
              characterName: 'Lin Mo',
              location: 'Debt Court',
              status: 'Confronts the magistrate',
              knowledge: 'Understands the larger scheme',
              emotion: 'Furious',
              powerLevel: 'Awakened',
            },
          ]),
      },
      sceneRecordExtractor: {
        extractScene: vi
          .fn()
          .mockResolvedValueOnce({
            location: 'Archive Gate',
            timeInStory: 'Dawn',
            charactersPresent: ['Lin Mo'],
            events: 'Lin Mo opens the sealed vault',
          })
          .mockResolvedValueOnce({
            location: 'Debt Court',
            timeInStory: 'Noon',
            charactersPresent: ['Lin Mo'],
            events: 'Lin Mo confronts the magistrate',
          }),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 2,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    const result = await service.writeRemainingChapters(bookId);
    const detail = service.getBookDetail(bookId);

    expect(result.completedChapters).toBe(2);
    expect(writeChapter).toHaveBeenCalledTimes(2);
    expect(writeChapter.mock.calls[1]?.[0].prompt).toContain(
      'Recent chapter summaries:'
    );
    expect(writeChapter.mock.calls[1]?.[0].prompt).toContain(
      'Chapter 1: Summary 1'
    );
    expect(writeChapter.mock.calls[1]?.[0].prompt).toContain(
      'Previous chapter ending:'
    );
    expect(writeChapter.mock.calls[1]?.[0].prompt).toContain(
      'heard the vault answer'
    );
    expect(writeChapter.mock.calls[1]?.[0].prompt).toContain(
      'Debt clue'
    );
    expect(writeChapter.mock.calls[1]?.[0].prompt).toContain(
      'Lin Mo: location=Archive Gate'
    );
    expect(writeChapter.mock.calls[1]?.[0].prompt).toContain(
      'Last scene: Dawn at Archive Gate'
    );
    expect(writeChapter.mock.calls[1]?.[0].prompt).toContain(
      'Treat the continuity context as hard constraints'
    );
    expect(detail?.book.status).toBe('completed');
    expect(detail?.progress?.phase).toBe('completed');
    expect(detail?.plotThreads).toEqual([
      expect.objectContaining({
        id: 'thread-1',
        resolvedAt: 2,
      }),
    ]);
    expect(detail?.characterStates).toEqual([
      expect.objectContaining({
        characterName: 'Lin Mo',
        location: 'Debt Court',
        status: 'Confronts the magistrate',
      }),
    ]);
    expect(detail?.latestScene).toEqual(
      expect.objectContaining({
        location: 'Debt Court',
        timeInStory: 'Noon',
        events: 'Lin Mo confronts the magistrate',
      })
    );
    expect(detail?.chapters).toEqual([
      expect.objectContaining({
        chapterIndex: 1,
        content:
          'Generated chapter 1. Lin Mo pressed the debt seal into the rain-soaked stone and heard the vault answer.',
        summary: 'Summary 1',
      }),
      expect.objectContaining({
        chapterIndex: 2,
        content: 'Generated chapter 2',
        summary: 'Summary 2',
      }),
    ]);
  });

  it('stops continuous writing after the current chapter when the book is paused', async () => {
    const db = createDatabase(':memory:');
    let service!: ReturnType<typeof createBookService>;
    const writeChapter = vi
      .fn()
      .mockResolvedValueOnce({
        content: 'Generated chapter 1',
        usage: { inputTokens: 100, outputTokens: 300 },
      })
      .mockResolvedValueOnce({
        content: 'Generated chapter 2',
        usage: { inputTokens: 120, outputTokens: 320 },
      });
    const summaryGenerator = vi
      .fn()
      .mockImplementationOnce(async () => {
        service.pauseBook(bookId);
        return 'Summary 1';
      })
      .mockResolvedValueOnce('Summary 2');

    service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
            {
              volumeIndex: 1,
              chapterIndex: 2,
              title: 'Chapter 2',
              outline: 'Escalation',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter,
      },
      summaryGenerator: {
        summarizeChapter: summaryGenerator,
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    const result = await service.writeRemainingChapters(bookId);
    const detail = service.getBookDetail(bookId);

    expect(result).toEqual({
      completedChapters: 1,
      status: 'paused',
    });
    expect(writeChapter).toHaveBeenCalledTimes(1);
    expect(detail?.book.status).toBe('paused');
    expect(detail?.progress?.phase).toBe('paused');
    expect(detail?.chapters[0]).toEqual(
      expect.objectContaining({
        chapterIndex: 1,
        content: 'Generated chapter 1',
      })
    );
    expect(detail?.chapters[1]).toEqual(
      expect.objectContaining({
        chapterIndex: 2,
        content: null,
      })
    );
  });

  it('resumes a paused book and finishes remaining chapters', async () => {
    const db = createDatabase(':memory:');
    const writeChapter = vi.fn().mockResolvedValue({
      content: 'Resumed chapter content',
      usage: { inputTokens: 90, outputTokens: 280 },
    });

    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: { writeChapter },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Resumed summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    service.pauseBook(bookId);
    await service.resumeBook(bookId);
    const detail = service.getBookDetail(bookId);

    expect(detail?.book.status).toBe('completed');
    expect(detail?.progress?.phase).toBe('completed');
    expect(detail?.chapters[0]).toEqual(
      expect.objectContaining({
        content: 'Resumed chapter content',
        summary: 'Resumed summary',
      })
    );
  });

  it('resumes planning_recheck books by replanning before writing again', async () => {
    const db = createDatabase(':memory:');
    const progress = createProgressRepository(db);
    const generateFromIdea = vi
      .fn()
      .mockResolvedValueOnce({
        worldSetting: 'Initial world rules',
        masterOutline: 'Initial master outline',
        volumeOutlines: ['Volume 1'],
        chapterOutlines: [
          {
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Initial Chapter 1',
            outline: 'Initial opening conflict',
          },
        ],
        chapterPlans: [
          {
            batchIndex: 1,
            chapterIndex: 1,
            arcIndex: 1,
            goal: 'Initial goal',
            conflict: 'Initial conflict',
            pressureSource: 'Initial pressure',
            changeType: 'Initial change',
            threadActions: [],
            reveal: 'Initial reveal',
            payoffOrCost: 'Initial payoff',
            endingHook: 'Initial hook',
            titleIdeaLink: 'Initial title link',
            batchGoal: 'Initial batch goal',
            requiredPayoffs: [],
            forbiddenDrift: [],
            status: 'pending',
          },
        ],
      })
      .mockResolvedValueOnce({
        worldSetting: 'Replanned world rules',
        masterOutline: 'Replanned master outline',
        volumeOutlines: ['Volume 1'],
        chapterOutlines: [
          {
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Replanned Chapter 1',
            outline: 'Replanned opening conflict',
          },
        ],
        chapterPlans: [
          {
            batchIndex: 1,
            chapterIndex: 1,
            arcIndex: 1,
            goal: 'Replanned goal',
            conflict: 'Replanned conflict',
            pressureSource: 'Replanned pressure',
            changeType: 'Replanned change',
            threadActions: [],
            reveal: 'Replanned reveal',
            payoffOrCost: 'Replanned payoff',
            endingHook: 'Replanned hook',
            titleIdeaLink: 'Replanned title link',
            batchGoal: 'Replanned batch goal',
            requiredPayoffs: [],
            forbiddenDrift: [],
            status: 'pending',
          },
        ],
      });
    const writeChapter = vi.fn().mockResolvedValue({
      content: 'Replanned chapter content',
      usage: { inputTokens: 90, outputTokens: 280 },
    });

    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      chapterPlans: createChapterPlanRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress,
      outlineService: {
        generateFromIdea,
      },
      chapterWriter: { writeChapter },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Replanned summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    progress.updatePhase(bookId, 'planning_recheck', {
      currentChapter: 1,
      stepLabel: '需要重新规划后续章节',
      activeTaskType: 'book:plan:rebuild-chapters',
    });
    service.pauseBook(bookId);
    await service.resumeBook(bookId);
    const detail = service.getBookDetail(bookId);

    expect(generateFromIdea).toHaveBeenCalledTimes(2);
    expect(writeChapter).toHaveBeenCalledTimes(1);
    expect(detail?.chapters[0]).toEqual(
      expect.objectContaining({
        title: 'Replanned Chapter 1',
        content: 'Replanned chapter content',
        summary: 'Replanned summary',
      })
    );
    expect(detail?.progress?.phase).toBe('completed');
  });

  it('writes planned chapter cards even when the legacy outline field is blank', async () => {
    const db = createDatabase(':memory:');
    const writeChapter = vi.fn().mockResolvedValue({
      content: '林牧终于翻开旧页，发现自己的名字被提前抹去。',
    });
    const chapterCards = createChapterCardRepository(db);

    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      chapterCards,
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockImplementation((input) =>
          Promise.resolve({
            worldSetting: '命簿会用记忆交换真相。',
            masterOutline: '林牧追查被抹去的家族记录。',
            volumeOutlines: ['第一卷'],
            chapterOutlines: [
              {
                volumeIndex: 1,
                chapterIndex: 1,
                title: '旧页初鸣',
                outline: '',
              },
            ],
            chapterCards: [
              {
                bookId: input.bookId,
                volumeIndex: 1,
                chapterIndex: 1,
                title: '旧页初鸣',
                plotFunction: '林牧发现旧页会回应他的血。',
                povCharacterId: 'lin-mu',
                externalConflict: '宗门执事逼他交出旧页。',
                internalConflict: '他想独自保密，却必须求助。',
                relationshipChange: '他欠下同伴一次人情。',
                worldRuleUsedOrTested: 'record-cost',
                informationReveal: '命簿改写会吞掉记忆。',
                readerReward: 'truth',
                endingHook: '旧页浮现林家姓名。',
                mustChange: '林牧从逃避变成主动追查。',
                forbiddenMoves: ['不能提前揭示幕后主使。'],
              },
            ],
          })
        ),
      },
      chapterWriter: { writeChapter },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('林牧开始追查命簿。'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: '命簿',
      targetChapters: 1,
      wordsPerChapter: 1200,
    });

    await service.startBook(bookId);
    const result = await service.writeRemainingChapters(bookId);
    const detail = service.getBookDetail(bookId);

    expect(result).toEqual({
      completedChapters: 1,
      status: 'completed',
    });
    expect(writeChapter).toHaveBeenCalledTimes(1);
    expect(writeChapter.mock.calls[0]?.[0].prompt).toContain(
      '宗门执事逼他交出旧页'
    );
    expect(detail?.chapters[0]).toMatchObject({
      content: '林牧终于翻开旧页，发现自己的名字被提前抹去。',
      summary: '林牧开始追查命簿。',
    });
  });

  it('injects template-aware prompt context only for the narrative draft branch', async () => {
    const db = createDatabase(':memory:');
    const fallbackDb = createDatabase(':memory:');
    const writeChapter = vi
      .fn()
      .mockResolvedValueOnce({
        content: '第一章正文',
        usage: { inputTokens: 10, outputTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '第二章正文',
        usage: { inputTokens: 10, outputTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '第三章正文',
        usage: { inputTokens: 10, outputTokens: 20 },
      });
    const chapterCards = createChapterCardRepository(db);

    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      chapterCards,
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      bookContracts: {
        getByBook: vi.fn((bookId: string) => ({
          bookId,
          titlePromise: '每次升级都伴随代价。',
          corePremise: '林牧在宗门夹缝中争夺晋升资格。',
          mainlinePromise: '每次突破都会逼出更强对手。',
          protagonistCoreDesire: '活下来并向上爬。',
          protagonistNoDriftRules: ['不能脱离主线竞争太久。'],
          keyCharacterBoundaries: [],
          mandatoryPayoffs: ['展示一次可见得失。'],
          antiDriftRules: ['训练不能替代实战竞争。'],
          activeTemplate: 'progression' as const,
          createdAt: '2026-05-03T00:00:00.000Z',
          updatedAt: '2026-05-03T00:00:00.000Z',
        })),
      },
      outlineService: {
        generateFromIdea: vi.fn().mockImplementation((input) =>
          Promise.resolve({
            worldSetting: '命簿会用记忆交换真相。',
            masterOutline: '林牧追查被抹去的家族记录。',
            volumeOutlines: ['第一卷'],
            chapterOutlines: [
              {
                volumeIndex: 1,
                chapterIndex: 1,
                title: '旧页初鸣',
                outline: '',
              },
              {
                volumeIndex: 1,
                chapterIndex: 2,
                title: '夜雨追逃',
                outline: '林牧被迫撤离旧档阁。',
              },
            ],
            chapterCards: [
              {
                bookId: input.bookId,
                volumeIndex: 1,
                chapterIndex: 1,
                title: '旧页初鸣',
                plotFunction: '林牧发现旧页会回应他的血。',
                povCharacterId: 'lin-mu',
                externalConflict: '宗门执事逼他交出旧页。',
                internalConflict: '他想独自保密，却必须求助。',
                relationshipChange: '他欠下同伴一次人情。',
                worldRuleUsedOrTested: 'record-cost',
                informationReveal: '命簿改写会吞掉记忆。',
                readerReward: 'truth',
                endingHook: '旧页浮现林家姓名。',
                mustChange: '林牧从逃避变成主动追查。',
                forbiddenMoves: ['不能提前揭示幕后主使。'],
              },
            ],
          })
        ),
      },
      chapterWriter: { writeChapter },
      summaryGenerator: {
        summarizeChapter: vi
          .fn()
          .mockResolvedValueOnce('林牧开始追查命簿。')
          .mockResolvedValueOnce('林牧暂时甩开追兵。'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });
    const fallbackService = createBookService({
      books: createBookRepository(fallbackDb),
      chapters: createChapterRepository(fallbackDb),
      characters: createCharacterRepository(fallbackDb),
      plotThreads: createPlotThreadRepository(fallbackDb),
      sceneRecords: createSceneRecordRepository(fallbackDb),
      progress: createProgressRepository(fallbackDb),
      bookContracts: {
        getByBook: vi.fn((bookId: string) => ({
          bookId,
          titlePromise: '每次升级都伴随代价。',
          corePremise: '林牧在宗门夹缝中争夺晋升资格。',
          mainlinePromise: '每次突破都会逼出更强对手。',
          protagonistCoreDesire: '活下来并向上爬。',
          protagonistNoDriftRules: ['不能脱离主线竞争太久。'],
          keyCharacterBoundaries: [],
          mandatoryPayoffs: ['展示一次可见得失。'],
          antiDriftRules: ['训练不能替代实战竞争。'],
          activeTemplate: 'progression' as const,
          createdAt: '2026-05-03T00:00:00.000Z',
          updatedAt: '2026-05-03T00:00:00.000Z',
        })),
      },
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: '命簿会用记忆交换真相。',
          masterOutline: '林牧追查被抹去的家族记录。',
          volumeOutlines: ['第一卷'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: '夜雨追逃',
              outline: '林牧被迫撤离旧档阁。',
            },
          ],
        }),
      },
      chapterWriter: { writeChapter },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('林牧暂时甩开追兵。'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: '命簿',
      targetChapters: 2,
      wordsPerChapter: 1200,
    });
    const fallbackBookId = fallbackService.createBook({
      idea: '命簿',
      targetChapters: 1,
      wordsPerChapter: 1200,
    });

    await service.startBook(bookId);
    await fallbackService.startBook(fallbackBookId);
    await service.writeNextChapter(bookId);
    await fallbackService.writeNextChapter(fallbackBookId);

    expect(writeChapter).toHaveBeenCalledTimes(2);
    expect(writeChapter.mock.calls[0]?.[0].prompt).toContain(
      'Template: progression'
    );
    expect(writeChapter.mock.calls[0]?.[0].prompt).toContain('Anti-drift:');
    expect(writeChapter.mock.calls[1]?.[0].prompt).not.toContain(
      'Template: progression'
    );
  });

  it('restarts a book by clearing generated state and rewriting chapters from outline', async () => {
    const db = createDatabase(':memory:');
    const writeChapter = vi
      .fn()
      .mockResolvedValueOnce({
        content: 'First run content',
        usage: { inputTokens: 80, outputTokens: 260 },
      })
      .mockResolvedValueOnce({
        content: 'Restarted content',
        usage: { inputTokens: 85, outputTokens: 270 },
      });

    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: { writeChapter },
      summaryGenerator: {
        summarizeChapter: vi
          .fn()
          .mockResolvedValueOnce('First summary')
          .mockResolvedValueOnce('Restarted summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi
          .fn()
          .mockResolvedValueOnce({
            openedThreads: [
              {
                id: 'thread-1',
                description: 'Old thread',
                plantedAt: 1,
                expectedPayoff: 3,
                importance: 'normal',
              },
            ],
            resolvedThreadIds: [],
          })
          .mockResolvedValueOnce({
            openedThreads: [],
            resolvedThreadIds: [],
          }),
      },
      characterStateExtractor: {
        extractStates: vi
          .fn()
          .mockResolvedValueOnce([
            {
              characterId: 'protagonist',
              characterName: 'Lin Mo',
              location: 'Archive Gate',
              status: 'First run status',
              knowledge: 'Knows one secret',
              emotion: 'Alert',
              powerLevel: 'Awakened',
            },
          ])
          .mockResolvedValueOnce([
            {
              characterId: 'protagonist',
              characterName: 'Lin Mo',
              location: 'Debt Court',
              status: 'Restarted status',
              knowledge: 'Knows the larger scheme',
              emotion: 'Focused',
              powerLevel: 'Awakened',
            },
          ]),
      },
      sceneRecordExtractor: {
        extractScene: vi
          .fn()
          .mockResolvedValueOnce({
            location: 'Archive Gate',
            timeInStory: 'Dawn',
            charactersPresent: ['Lin Mo'],
            events: 'First run scene',
          })
          .mockResolvedValueOnce({
            location: 'Debt Court',
            timeInStory: 'Noon',
            charactersPresent: ['Lin Mo'],
            events: 'Restarted scene',
          }),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);
    await service.restartBook(bookId);
    const detail = service.getBookDetail(bookId);

    expect(detail?.book.status).toBe('completed');
    expect(detail?.progress?.phase).toBe('completed');
    expect(detail?.plotThreads).toEqual([]);
    expect(detail?.characterStates).toEqual([
      expect.objectContaining({
        location: 'Debt Court',
        status: 'Restarted status',
      }),
    ]);
    expect(detail?.latestScene).toEqual(
      expect.objectContaining({
        location: 'Debt Court',
        events: 'Restarted scene',
      })
    );
    expect(detail?.chapters[0]).toEqual(
      expect.objectContaining({
        content: 'Restarted content',
        summary: 'Restarted summary',
      })
    );
  });

  it('restarts a failed book from planning instead of resuming an empty outline', async () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateTitleFromIdea: vi
          .fn()
          .mockResolvedValueOnce('Old Failed Title')
          .mockResolvedValueOnce('Restarted Title'),
        generateFromIdea: vi
          .fn()
          .mockRejectedValueOnce(new Error('first planning failed'))
          .mockResolvedValueOnce({
            worldSetting: 'Restarted world',
            masterOutline: 'Restarted outline',
            volumeOutlines: ['Volume 1'],
            chapterOutlines: [
              {
                volumeIndex: 1,
                chapterIndex: 1,
                title: 'Restarted Chapter',
                outline: 'Restarted opening',
              },
            ],
          }),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: 'Restarted content',
          usage: { inputTokens: 85, outputTokens: 270 },
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Restarted summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: '道侣越多我越无敌。',
      targetChapters: 1,
      wordsPerChapter: 2000,
    });

    await expect(service.startBook(bookId)).rejects.toThrow('first planning failed');
    await service.restartBook(bookId);

    const detail = service.getBookDetail(bookId);
    expect(detail?.book).toMatchObject({
      title: 'Restarted Title',
      status: 'completed',
    });
    expect(detail?.context).toMatchObject({
      worldSetting: 'Restarted world',
      outline: 'Restarted outline',
    });
    expect(detail?.chapters).toMatchObject([
      expect.objectContaining({
        title: 'Restarted Chapter',
        content: 'Restarted content',
        wordCount: 16,
      }),
    ]);
    expect(detail?.progress?.phase).toBe('completed');
    expect(detail?.progress?.errorMsg).toBeNull();
  });

  it('deletes a paused book and clears persisted detail state', async () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: 'Chapter 1',
              outline: 'Opening conflict',
            },
          ],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: 'Generated chapter content',
          usage: { inputTokens: 100, outputTokens: 300 },
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Chapter summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [
            {
              id: 'thread-1',
              description: 'Debt clue',
              plantedAt: 1,
              expectedPayoff: 3,
              importance: 'normal',
            },
          ],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([
          {
            characterId: 'protagonist',
            characterName: 'Lin Mo',
            location: 'Archive Gate',
            status: 'Opens the sealed vault',
            knowledge: 'Found the debt sigil',
            emotion: 'Determined',
            powerLevel: 'Awakened',
          },
        ]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue({
          location: 'Archive Gate',
          timeInStory: 'Dawn',
          charactersPresent: ['Lin Mo'],
          events: 'Lin Mo opens the sealed vault',
        }),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);
    service.pauseBook(bookId);

    service.deleteBook(bookId);

    expect(service.listBooks()).toEqual([]);
    expect(service.getBookDetail(bookId)).toBeNull();
  });

  it('deletes a started book even if it has not been paused yet', async () => {
    const db = createDatabase(':memory:');
    const service = createBookService({
      books: createBookRepository(db),
      chapters: createChapterRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      progress: createProgressRepository(db),
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [],
        }),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
    });

    const bookId = service.createBook({
      idea: 'The moon taxes miracles.',
      modelId: 'openai:gpt-4o-mini',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);
    service.deleteBook(bookId);

    expect(service.listBooks()).toEqual([]);
    expect(service.getBookDetail(bookId)).toBeNull();
  });
});
