import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createChapterRepository } from '@story-weaver/backend/storage/chapters';
import { createCharacterRepository } from '@story-weaver/backend/storage/characters';
import { createPlotThreadRepository } from '@story-weaver/backend/storage/plot-threads';
import { createProgressRepository } from '@story-weaver/backend/storage/progress';
import { createSceneRecordRepository } from '@story-weaver/backend/storage/scene-records';
import { createBookOrchestrator } from '@story-weaver/backend/core/orchestrator';
import type { BookGenerationEvent } from '@story-weaver/shared/contracts';

function createOrchestrator(input: Parameters<typeof createBookOrchestrator>[0]) {
  return createBookOrchestrator({
    resolveModelId: () => 'test:model',
    ...input,
  });
}

function createTestRepositories() {
  const db = createDatabase(':memory:');
  return {
    db,
    books: createBookRepository(db),
    chapters: createChapterRepository(db),
    characters: createCharacterRepository(db),
    plotThreads: createPlotThreadRepository(db),
    sceneRecords: createSceneRecordRepository(db),
    progress: createProgressRepository(db),
  };
}

function createMinimalDeps(overrides: Record<string, unknown> = {}) {
  const repos = createTestRepositories();
  return {
    ...repos,
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
    ...overrides,
  };
}

describe('createBookOrchestrator', () => {
  it('creates a book and lists it', () => {
    const orchestrator = createOrchestrator(createMinimalDeps());
    const bookId = orchestrator.createBook({
      title: 'Promise Ledger',
      idea: 'A city remembers every promise.',
      targetChapters: 3,
      wordsPerChapter: 2500,
    });

    const books = orchestrator.listBooks();

    expect(bookId).toBeTruthy();
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      id: bookId,
      title: 'Promise Ledger',
      titleGenerationStatus: 'manual',
      idea: 'A city remembers every promise.',
      targetChapters: 3,
      wordsPerChapter: 2500,
      status: 'creating',
    });
  });

  it('returns book detail for an existing book', () => {
    const orchestrator = createOrchestrator(createMinimalDeps());
    const bookId = orchestrator.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    const detail = orchestrator.getBookDetail(bookId);

    expect(detail).not.toBeNull();
    expect(detail?.book.id).toBe(bookId);
    expect(detail?.book.idea).toBe('The moon taxes miracles.');
    expect(detail?.progress?.phase).toBe('creating');
  });

  it('returns null for a non-existent book', () => {
    const orchestrator = createOrchestrator(createMinimalDeps());
    expect(orchestrator.getBookDetail('non-existent')).toBeNull();
  });

  it('starts a book by delegating to the outline aggregate', async () => {
    const onBookUpdated = vi.fn();
    const resolveModelId = vi.fn().mockReturnValue('openai:gpt-4o-mini');
    const outlineService = {
      generateTitleFromIdea: vi.fn().mockResolvedValue('Generated Title'),
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
    };

    const orchestrator = createOrchestrator(
      createMinimalDeps({
        outlineService,
        resolveModelId,
        onBookUpdated,
      })
    );

    const bookId = orchestrator.createBook({
      idea: 'A city remembers every promise.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await orchestrator.startBook(bookId);
    const detail = orchestrator.getBookDetail(bookId);

    expect(resolveModelId).toHaveBeenCalled();
    expect(outlineService.generateFromIdea).toHaveBeenCalled();
    expect(detail?.book.title).toBe('Generated Title');
    expect(detail?.book.status).toBe('building_outline');
    expect(detail?.context?.worldSetting).toBe('World rules');
    expect(detail?.chapters).toHaveLength(1);
  });

  it('throws when starting a non-existent book', async () => {
    const orchestrator = createOrchestrator(createMinimalDeps());
    await expect(orchestrator.startBook('non-existent')).rejects.toThrow(
      'Book not found: non-existent'
    );
  });

  it('writes the next chapter via the chapter aggregate', async () => {
    const orchestrator = createOrchestrator(createMinimalDeps());
    const bookId = orchestrator.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await orchestrator.startBook(bookId);
    await orchestrator.writeNextChapter(bookId);
    const detail = orchestrator.getBookDetail(bookId);

    expect(detail?.book.status).toBe('writing');
    expect(detail?.chapters[0]).toMatchObject({
      content: 'Generated chapter content',
      summary: 'Chapter summary',
    });
  });

  it('writes all remaining chapters and marks the book completed', async () => {
    const writeChapter = vi
      .fn()
      .mockResolvedValueOnce({
        content: 'Chapter 1 content',
        usage: { inputTokens: 100, outputTokens: 300 },
      })
      .mockResolvedValueOnce({
        content: 'Chapter 2 content',
        usage: { inputTokens: 120, outputTokens: 320 },
      });

    const orchestrator = createOrchestrator(
      createMinimalDeps({
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
        chapterWriter: { writeChapter },
      })
    );

    const bookId = orchestrator.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 2,
      wordsPerChapter: 2500,
    });

    await orchestrator.startBook(bookId);
    const result = await orchestrator.writeRemainingChapters(bookId);
    const detail = orchestrator.getBookDetail(bookId);

    expect(result.completedChapters).toBe(2);
    expect(result.status).toBe('completed');
    expect(writeChapter).toHaveBeenCalledTimes(2);
    expect(detail?.book.status).toBe('completed');
    expect(detail?.progress?.phase).toBe('completed');
  });

  it('pauses a book and persists the paused phase', async () => {
    const orchestrator = createOrchestrator(createMinimalDeps());
    const bookId = orchestrator.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 2,
      wordsPerChapter: 2500,
    });

    await orchestrator.startBook(bookId);
    orchestrator.pauseBook(bookId);
    const detail = orchestrator.getBookDetail(bookId);

    expect(detail?.book.status).toBe('paused');
    expect(detail?.progress?.phase).toBe('paused');
  });

  it('resumes a paused book and finishes remaining chapters', async () => {
    const writeChapter = vi.fn().mockResolvedValue({
      content: 'Resumed chapter content',
      usage: { inputTokens: 90, outputTokens: 280 },
    });

    const orchestrator = createOrchestrator(
      createMinimalDeps({ chapterWriter: { writeChapter } })
    );

    const bookId = orchestrator.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await orchestrator.startBook(bookId);
    orchestrator.pauseBook(bookId);
    await orchestrator.resumeBook(bookId);
    const detail = orchestrator.getBookDetail(bookId);

    expect(detail?.book.status).toBe('completed');
    expect(detail?.progress?.phase).toBe('completed');
    expect(detail?.chapters[0]).toMatchObject({
      content: 'Resumed chapter content',
      summary: 'Chapter summary',
    });
  });

  it('throws when resuming a non-existent book', async () => {
    const orchestrator = createOrchestrator(createMinimalDeps());
    await expect(orchestrator.resumeBook('non-existent')).rejects.toThrow(
      'Book not found: non-existent'
    );
  });

  it('deletes a book and clears all persisted state', async () => {
    const orchestrator = createOrchestrator(createMinimalDeps());
    const bookId = orchestrator.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await orchestrator.startBook(bookId);
    orchestrator.deleteBook(bookId);

    expect(orchestrator.listBooks()).toEqual([]);
    expect(orchestrator.getBookDetail(bookId)).toBeNull();
  });

  it('deletes a book idempotently without error', () => {
    const orchestrator = createOrchestrator(createMinimalDeps());
    expect(() => orchestrator.deleteBook('non-existent')).not.toThrow();
  });

  it('restarts a book by clearing state and rewriting from outline', async () => {
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

    const orchestrator = createOrchestrator(
      createMinimalDeps({ chapterWriter: { writeChapter } })
    );

    const bookId = orchestrator.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await orchestrator.startBook(bookId);
    await orchestrator.writeNextChapter(bookId);
    await orchestrator.restartBook(bookId);
    const detail = orchestrator.getBookDetail(bookId);

    expect(detail?.book.status).toBe('completed');
    expect(detail?.progress?.phase).toBe('completed');
    expect(detail?.chapters[0]).toMatchObject({
      content: 'Restarted content',
      summary: 'Chapter summary',
    });
  });

  it('throws when restarting a non-existent book', async () => {
    const orchestrator = createOrchestrator(createMinimalDeps());
    await expect(orchestrator.restartBook('non-existent')).rejects.toThrow(
      'Book not found: non-existent'
    );
  });

  it('runs the full lifecycle: create -> start -> write all -> complete', async () => {
    const events: BookGenerationEvent[] = [];
    const onBookUpdated = vi.fn();
    const writeChapter = vi.fn().mockResolvedValue({
      content: 'Full lifecycle content',
      usage: { inputTokens: 100, outputTokens: 300 },
    });

    const orchestrator = createOrchestrator(
      createMinimalDeps({
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
        onBookUpdated,
        onGenerationEvent: (event: BookGenerationEvent) => {
          events.push(event);
        },
      })
    );

    const bookId = orchestrator.createBook({
      idea: 'A city remembers every promise.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    expect(orchestrator.listBooks()[0].status).toBe('creating');

    await orchestrator.startBook(bookId);
    expect(orchestrator.getBookDetail(bookId)?.book.status).toBe(
      'building_outline'
    );

    const result = await orchestrator.writeRemainingChapters(bookId);
    expect(result).toEqual({ completedChapters: 1, status: 'completed' });

    const detail = orchestrator.getBookDetail(bookId);
    expect(detail?.book.status).toBe('completed');
    expect(detail?.progress?.phase).toBe('completed');
    expect(detail?.chapters[0]?.content).toBe('Full lifecycle content');
    expect(onBookUpdated).toHaveBeenCalledWith(bookId);
    expect(events.some((e) => e.type === 'chapter-complete')).toBe(true);
  });

  it('stops writing remaining chapters when a book is paused mid-flight', async () => {
    const repos = createTestRepositories();
    let orchestrator!: ReturnType<typeof createOrchestrator>;
    const summaryGenerator = vi.fn().mockImplementation(async () => {
      orchestrator.pauseBook(bookId);
      return 'Summary 1';
    });

    orchestrator = createOrchestrator({
      ...repos,
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
        writeChapter: vi.fn().mockResolvedValue({
          content: 'Generated content',
          usage: { inputTokens: 100, outputTokens: 300 },
        }),
      },
      summaryGenerator: { summarizeChapter: summaryGenerator },
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

    const bookId = orchestrator.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 2,
      wordsPerChapter: 2500,
    });

    await orchestrator.startBook(bookId);
    const result = await orchestrator.writeRemainingChapters(bookId);

    expect(result).toEqual({
      completedChapters: 1,
      status: 'paused',
    });
  });

  it('returns deleted status when a book is deleted during writing', async () => {
    const repos = createTestRepositories();
    let orchestrator!: ReturnType<typeof createOrchestrator>;

    const writeChapter = vi.fn().mockImplementation(async () => {
      // Delete the book during chapter writing
      orchestrator.deleteBook(bookId);
      return {
        content: 'Generated content',
        usage: { inputTokens: 100, outputTokens: 300 },
      };
    });

    orchestrator = createOrchestrator({
      ...repos,
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
        summarizeChapter: vi.fn().mockResolvedValue('Summary'),
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

    const bookId = orchestrator.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await orchestrator.startBook(bookId);
    const result = await orchestrator.writeRemainingChapters(bookId);

    expect(result).toEqual({
      completedChapters: 0,
      status: 'deleted',
    });
  });

  it('emits generation events through the chapter writing pipeline', async () => {
    const events: BookGenerationEvent[] = [];
    const writeChapter = vi.fn().mockImplementation(async ({ onChunk }) => {
      onChunk?.('chunk1');
      return {
        content: 'Generated content',
        usage: { inputTokens: 100, outputTokens: 300 },
      };
    });

    const orchestrator = createOrchestrator(
      createMinimalDeps({
        chapterWriter: { writeChapter },
        onGenerationEvent: (event: BookGenerationEvent) => {
          events.push(event);
        },
      })
    );

    const bookId = orchestrator.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await orchestrator.startBook(bookId);
    events.splice(0, events.length);
    await orchestrator.writeNextChapter(bookId);

    expect(events.some((e) => e.type === 'progress' && e.phase === 'writing')).toBe(true);
    expect(events.some((e) => e.type === 'chapter-stream')).toBe(true);
    expect(events.some((e) => e.type === 'chapter-complete')).toBe(true);
  });

  it('rejects invalid chapter limits before persistence', () => {
    const orchestrator = createOrchestrator(createMinimalDeps());

    expect(() =>
      orchestrator.createBook({
        idea: 'Test',
        targetChapters: 0,
        wordsPerChapter: 2500,
      })
    ).toThrow('Target chapters must be a positive integer');

    expect(() =>
      orchestrator.createBook({
        idea: 'Test',
        targetChapters: 5,
        wordsPerChapter: 0,
      })
    ).toThrow('Words per chapter must be a positive integer');
  });

  it('notifies onBookUpdated after chapter content is persisted', async () => {
    const onBookUpdated = vi.fn();
    const orchestrator = createOrchestrator(
      createMinimalDeps({ onBookUpdated })
    );

    const bookId = orchestrator.createBook({
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    await orchestrator.startBook(bookId);
    onBookUpdated.mockClear();
    await orchestrator.writeNextChapter(bookId);

    expect(onBookUpdated).toHaveBeenCalledWith(bookId);
  });
});
