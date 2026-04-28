import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../../src/storage/database';
import { createBookRepository } from '../../src/storage/books';
import { createChapterRepository } from '../../src/storage/chapters';
import { createCharacterRepository } from '../../src/storage/characters';
import { createPlotThreadRepository } from '../../src/storage/plot-threads';
import { createProgressRepository } from '../../src/storage/progress';
import { createSceneRecordRepository } from '../../src/storage/scene-records';
import { createBookService } from '../../src/core/book-service';

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
      targetChapters: 500,
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
      targetChapters: 500,
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
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    await service.startBook(bookId);

    expect(onBookUpdated).toHaveBeenCalledTimes(5);
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
      targetChapters: 500,
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
      targetChapters: 500,
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
      targetChapters: 500,
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
      targetChapters: 500,
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
      targetChapters: 500,
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
      targetChapters: 500,
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
      targetChapters: 500,
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
