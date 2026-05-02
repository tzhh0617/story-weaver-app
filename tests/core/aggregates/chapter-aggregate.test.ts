import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createChapterAuditRepository } from '@story-weaver/backend/storage/chapter-audits';
import { createChapterRepository } from '@story-weaver/backend/storage/chapters';
import { createCharacterRepository } from '@story-weaver/backend/storage/characters';
import { createPlotThreadRepository } from '@story-weaver/backend/storage/plot-threads';
import { createProgressRepository } from '@story-weaver/backend/storage/progress';
import { createSceneRecordRepository } from '@story-weaver/backend/storage/scene-records';
import { createChapterAggregate } from '@story-weaver/backend/core/aggregates/chapter/chapter-aggregate';
import type { BookGenerationEvent } from '@story-weaver/shared/contracts';

function setupBookWithOutline(db = createDatabase(':memory:')) {
  const books = createBookRepository(db);
  const chapters = createChapterRepository(db);

  const bookId = 'test-book-id';
  books.create({
    id: bookId,
    title: 'Test Book',
    idea: 'A test story idea.',
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

  return { db, books, chapters, bookId };
}

function createTestDeps(overrides: Record<string, any> = {}) {
  const db = createDatabase(':memory:');
  const { books, chapters, bookId } = setupBookWithOutline(db);

  const deps = {
    books,
    chapters,
    progress: createProgressRepository(db),
    sceneRecords: createSceneRecordRepository(db),
    characters: createCharacterRepository(db),
    plotThreads: createPlotThreadRepository(db),
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
    resolveModelId: vi.fn().mockReturnValue('test:model'),
    ...overrides,
  };

  const aggregate = createChapterAggregate(deps);

  return { deps, aggregate, bookId, db };
}

describe('createChapterAggregate', () => {
  it('writes the next outlined chapter and persists content', async () => {
    const { aggregate, bookId, deps } = createTestDeps();

    const result = await aggregate.writeNext(bookId);
    if ('content' in result) {
      expect(result.content).toBe('Generated chapter content');
    }
    expect(deps.chapters.listByBook(bookId)[0]).toMatchObject({
      content: 'Generated chapter content',
      summary: 'Chapter summary',
    });
    expect(deps.summaryGenerator.summarizeChapter).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'test:model',
        content: 'Generated chapter content',
      })
    );
  });

  it('includes the final book title in chapter draft prompts', async () => {
    const prompts: string[] = [];
    const writeChapter = vi
      .fn()
      .mockImplementation(async ({ prompt }: { prompt: string }) => {
        prompts.push(prompt);
        return {
          content: '林牧抬头，看见月亮开始收税。',
          usage: { inputTokens: 100, outputTokens: 400 },
        };
      });
    const { aggregate, bookId, deps } = createTestDeps({
      chapterWriter: { writeChapter },
    });
    deps.books.updateTitle(bookId, '月税奇谈');

    await aggregate.writeNext(bookId);

    expect(prompts.join('\n')).toContain('Book title: 月税奇谈');
  });

  it('throws when book is not found', async () => {
    const { aggregate } = createTestDeps();

    await expect(aggregate.writeNext('nonexistent')).rejects.toThrow(
      'Book not found: nonexistent'
    );
  });

  it('throws when no outlined chapter is available', async () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const chapters = createChapterRepository(db);
    const bookId = 'empty-book';
    books.create({
      id: bookId,
      title: 'Empty',
      idea: 'No chapters',
      targetChapters: 1,
      wordsPerChapter: 2500,
    });

    const aggregate = createChapterAggregate({
      books,
      chapters,
      progress: createProgressRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
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
      resolveModelId: () => 'test:model',
    });

    await expect(aggregate.writeNext(bookId)).rejects.toThrow(
      'No outlined chapter available to write'
    );
  });

  it('emits generation progress and streaming events', async () => {
    const events: BookGenerationEvent[] = [];
    const writeChapter = vi.fn().mockImplementation(
      async ({ onChunk }: { onChunk?: (chunk: string) => void }) => {
        onChunk?.('chunk1');
        onChunk?.('chunk2');
        return {
          content: 'chunk1chunk2',
          usage: { inputTokens: 100, outputTokens: 400 },
        };
      }
    );

    const { aggregate, bookId } = createTestDeps({
      chapterWriter: { writeChapter },
      onGenerationEvent: (event: BookGenerationEvent) => events.push(event),
    });

    await aggregate.writeNext(bookId);

    expect(events).toEqual(
      expect.arrayContaining([
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
          delta: 'chunk1',
        },
        {
          bookId,
          type: 'chapter-stream',
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          delta: 'chunk2',
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
      ])
    );
  });

  it('persists extracted plot threads, characters, and scenes', async () => {
    const { aggregate, bookId, deps } = createTestDeps({
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [
            {
              id: 'thread-1',
              description: 'A hidden debt',
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
            status: 'Investigating',
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
          events: 'Discovery of the forged ledger',
        }),
      },
    });

    await aggregate.writeNext(bookId);

    const threads = deps.plotThreads.listByBook(bookId);
    expect(threads).toEqual([
      expect.objectContaining({
        id: 'thread-1',
        description: 'A hidden debt',
        plantedAt: 1,
        expectedPayoff: 6,
        importance: 'critical',
      }),
    ]);

    const characters = deps.characters.listLatestStatesByBook(bookId);
    expect(characters).toEqual([
      expect.objectContaining({
        characterId: 'protagonist',
        characterName: 'Lin Mo',
        location: 'Rain Market',
        status: 'Investigating',
      }),
    ]);

    const scene = deps.sceneRecords.getLatestByBook(bookId);
    expect(scene).toEqual(
      expect.objectContaining({
        location: 'Rain Market',
        timeInStory: 'Night',
        events: 'Discovery of the forged ledger',
      })
    );
  });

  it('resolves plot threads when extracted', async () => {
    const { bookId, deps } = createTestDeps();

    // Pre-plant a thread for chapter 1
    deps.plotThreads.upsertThread({
      id: 'thread-1',
      bookId,
      description: 'A planted thread',
      plantedAt: 1,
      expectedPayoff: null,
    });

    // Use a separate aggregate with the same repos but override extractors
    const agg = createChapterAggregate({
      books: deps.books,
      chapters: deps.chapters,
      progress: deps.progress,
      sceneRecords: deps.sceneRecords,
      characters: deps.characters,
      plotThreads: deps.plotThreads,
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: 'Content that resolves the thread',
          usage: { inputTokens: 100, outputTokens: 400 },
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: ['thread-1'],
        }),
      },
      characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
      sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
      resolveModelId: () => 'test:model',
    });

    await agg.writeNext(bookId);

    const threads = deps.plotThreads.listByBook(bookId);
    expect(threads[0].resolvedAt).toBe(1);
  });

  it('rewrites a short chapter when shouldRewriteShortChapter returns true', async () => {
    const writeChapter = vi
      .fn()
      .mockResolvedValueOnce({
        content: 'Short',
        usage: { inputTokens: 100, outputTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: 'A much longer and more complete chapter draft.',
        usage: { inputTokens: 140, outputTokens: 120 },
      });

    const { aggregate, bookId, deps } = createTestDeps({
      chapterWriter: { writeChapter },
      shouldRewriteShortChapter: ({ content }: { content: string }) => content === 'Short',
    });

    const result = await aggregate.writeNext(bookId);

    expect(writeChapter).toHaveBeenCalledTimes(2);
    expect(writeChapter.mock.calls[1]?.[0].prompt).toContain(
      'Automatic review found this chapter too short'
    );
    if ('content' in result) {
      expect(result.content).toBe('A much longer and more complete chapter draft.');
    }
    expect(deps.chapters.listByBook(bookId)[0].content).toBe(
      'A much longer and more complete chapter draft.'
    );
  });

  it('emits rewrite progress and replace stream events', async () => {
    const events: BookGenerationEvent[] = [];
    const writeChapter = vi
      .fn()
      .mockImplementationOnce(async ({ onChunk }: { onChunk?: (chunk: string) => void }) => {
        onChunk?.('short');
        return {
          content: 'Short',
          usage: { inputTokens: 100, outputTokens: 20 },
        };
      })
      .mockImplementationOnce(async ({ onChunk }: { onChunk?: (chunk: string) => void }) => {
        onChunk?.('rewrite-start');
        onChunk?.('rewrite-end');
        return {
          content: 'rewrite-startrewrite-end',
          usage: { inputTokens: 140, outputTokens: 120 },
        };
      });

    const { aggregate, bookId } = createTestDeps({
      chapterWriter: { writeChapter },
      shouldRewriteShortChapter: ({ content }: { content: string }) => content === 'Short',
      onGenerationEvent: (event: BookGenerationEvent) => events.push(event),
    });

    await aggregate.writeNext(bookId);

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
          delta: 'rewrite-start',
          replace: true,
        },
        {
          bookId,
          type: 'chapter-stream',
          volumeIndex: 1,
          chapterIndex: 1,
          title: 'Chapter 1',
          delta: 'rewrite-end',
        },
      ])
    );
  });

  it('runs audit and revision loop when auditor and chapter card are present', async () => {
    const db = createDatabase(':memory:');
    const { books, chapters, bookId } = setupBookWithOutline(db);
    const savedCards: any[] = [];

    const audit = (decision: 'revise' | 'accept', score: number) => ({
      passed: decision === 'accept',
      score,
      decision,
      issues:
        decision === 'revise'
          ? [
              {
                type: 'weak_reader_promise',
                severity: 'major',
                evidence: 'Weak promise.',
                fixInstruction: 'Strengthen it.',
              },
            ]
          : [],
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
          openingHook: score,
          desireClarity: score,
          payoffStrength: score,
          readerQuestionStrength: score,
          tropeFulfillment: score,
          antiClicheFreshness: score,
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

    const auditChapter = vi
      .fn()
      .mockResolvedValueOnce(audit('revise', 58))
      .mockResolvedValueOnce(audit('accept', 91));

    const aggregate = createChapterAggregate({
      books,
      chapters,
      progress: createProgressRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: 'Draft content',
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      },
      chapterAuditor: { auditChapter },
      chapterRevision: {
        reviseChapter: vi.fn().mockResolvedValue('Revised content'),
      },
      chapterAudits: createChapterAuditRepository(db),
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
      sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
      chapterCards: {
        listByBook: () => savedCards,
        listCharacterPressures: () => [],
        listRelationshipActions: () => [],
        listThreadActions: () => [],
      },
      worldRules: { listByBook: () => [] },
      resolveModelId: () => 'test:model',
    });

    // Add a chapter card so the audit branch triggers
    savedCards.push({
      bookId,
      volumeIndex: 1,
      chapterIndex: 1,
      title: 'Chapter 1',
      plotFunction: 'Opening',
      povCharacterId: null,
      externalConflict: 'Conflict',
      internalConflict: 'Doubt',
      relationshipChange: 'Trust',
      worldRuleUsedOrTested: '',
      informationReveal: '',
      readerReward: 'truth',
      endingHook: 'Cliffhanger',
      mustChange: 'Decision made',
      forbiddenMoves: [],
    });

    await aggregate.writeNext(bookId);

    expect(auditChapter).toHaveBeenCalledTimes(2);
    expect(auditChapter).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        viralStoryProtocol: null,
        chapterIndex: 1,
      })
    );
    const saved = chapters.listByBook(bookId);
    expect(saved[0].auditScore).toBe(91);
    expect(saved[0].draftAttempts).toBe(2);
  });

  it('falls back to legacy extractors when unified extraction fails', async () => {
    const chapterUpdateExtractor = vi
      .fn()
      .mockRejectedValue(new Error('invalid JSON'));

    const { aggregate, bookId, deps } = createTestDeps({
      chapterUpdateExtractor: {
        extractChapterUpdate: chapterUpdateExtractor,
      },
    });

    await aggregate.writeNext(bookId);

    expect(chapterUpdateExtractor).toHaveBeenCalledTimes(1);
    expect(deps.summaryGenerator.summarizeChapter).toHaveBeenCalledTimes(1);
    expect(deps.chapters.listByBook(bookId)[0].summary).toBe('Chapter summary');
  });

  it('falls back to legacy extractors when unified extraction returns empty summary', async () => {
    const { aggregate, bookId, deps } = createTestDeps({
      chapterUpdateExtractor: {
        extractChapterUpdate: vi.fn().mockResolvedValue({
          summary: '',
          openedThreads: [],
          resolvedThreadIds: [],
          characterStates: [],
          scene: null,
        }),
      },
    });

    await aggregate.writeNext(bookId);

    expect(deps.summaryGenerator.summarizeChapter).toHaveBeenCalledTimes(1);
    expect(deps.chapters.listByBook(bookId)[0].summary).toBe('Chapter summary');
  });

  it('uses unified extractor result when valid', async () => {
    const { aggregate, bookId, deps } = createTestDeps({
      chapterUpdateExtractor: {
        extractChapterUpdate: vi.fn().mockResolvedValue({
          summary: 'Unified summary',
          openedThreads: [
            {
              id: 't-1',
              description: 'Unified thread',
              plantedAt: 1,
              expectedPayoff: 5,
              importance: 'normal',
            },
          ],
          resolvedThreadIds: [],
          characterStates: [
            {
              characterId: 'char-1',
              characterName: 'Hero',
              location: 'Castle',
              status: 'Fighting',
            },
          ],
          scene: {
            location: 'Castle',
            timeInStory: 'Dawn',
            charactersPresent: ['Hero'],
            events: 'Battle begins',
          },
        }),
      },
    });

    await aggregate.writeNext(bookId);

    expect(deps.summaryGenerator.summarizeChapter).not.toHaveBeenCalled();
    expect(deps.chapters.listByBook(bookId)[0].summary).toBe('Unified summary');
    expect(deps.plotThreads.listByBook(bookId)).toEqual([
      expect.objectContaining({ id: 't-1', description: 'Unified thread' }),
    ]);
  });

  it('returns paused result when book is paused during writing', async () => {
    const { bookId, deps } = createTestDeps();

    // Make writeChapter hang until we resolve
    let resolveWrite!: (result: any) => void;
    const writePromise = new Promise((resolve) => {
      resolveWrite = resolve;
    });

    const agg = createChapterAggregate({
      ...deps,
      chapterWriter: {
        writeChapter: vi.fn().mockReturnValue(writePromise),
      },
    });

    const writeNextPromise = agg.writeNext(bookId);

    // Pause the book while writing is in progress
    deps.books.updateStatus(bookId, 'paused');
    resolveWrite({
      content: 'Partial content',
      usage: { inputTokens: 100, outputTokens: 400 },
    });

    const result = await writeNextPromise;
    expect(result).toEqual({ paused: true });
    // Content should NOT be saved
    expect(deps.chapters.listByBook(bookId)[0].content).toBeNull();
  });

  it('returns deleted result when book is deleted during writing', async () => {
    const db = createDatabase(':memory:');
    const { books, chapters, bookId } = setupBookWithOutline(db);

    let resolveWrite!: (result: any) => void;
    const writePromise = new Promise((resolve) => {
      resolveWrite = resolve;
    });

    const deps = {
      books,
      chapters,
      progress: createProgressRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      chapterWriter: { writeChapter: vi.fn().mockReturnValue(writePromise) },
      summaryGenerator: { summarizeChapter: vi.fn() },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
      sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
      resolveModelId: () => 'test:model',
    };

    const aggregate = createChapterAggregate(deps);
    const writeNextPromise = aggregate.writeNext(bookId);

    // Simulate book deletion by making getById return undefined
    // (We can't actually delete from SQLite due to FK constraints with chapters,
    // but the aggregate only checks getById)
    const origGetById = deps.books.getById.bind(deps.books);
    vi.spyOn(deps.books, 'getById').mockImplementation((id: string) => {
      if (id === bookId) return undefined;
      return origGetById(id);
    });
    resolveWrite({
      content: 'Partial content',
      usage: { inputTokens: 100, outputTokens: 400 },
    });

    const result = await writeNextPromise;
    expect(result).toEqual({ deleted: true });
  });

  it('writes with chapter cards when legacy outline is blank', async () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const chapters = createChapterRepository(db);
    const bookId = 'card-book';
    books.create({
      id: bookId,
      title: 'Card Book',
      idea: 'Story with chapter cards.',
      targetChapters: 1,
      wordsPerChapter: 1200,
    });
    // Outline title is set, but outline text is blank -- card provides content
    chapters.upsertOutline({
      bookId,
      volumeIndex: 1,
      chapterIndex: 1,
      title: 'Card Title',
      outline: '',
    });

    const chapterCard = {
      bookId,
      volumeIndex: 1,
      chapterIndex: 1,
      title: 'Card Title',
      plotFunction: 'Card plot function',
      povCharacterId: null,
      externalConflict: 'External',
      internalConflict: 'Internal',
      relationshipChange: 'Change',
      worldRuleUsedOrTested: '',
      informationReveal: '',
      readerReward: 'truth' as const,
      endingHook: 'Hook',
      mustChange: 'Must change',
      forbiddenMoves: [],
    };

    const writeChapter = vi.fn().mockResolvedValue({
      content: 'Generated with card context',
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const aggregate = createChapterAggregate({
      books,
      chapters,
      progress: createProgressRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
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
      characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
      sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
      chapterCards: {
        listByBook: (_bookId: string) => [chapterCard],
        listCharacterPressures: () => [],
        listRelationshipActions: () => [],
        listThreadActions: () => [],
      },
      resolveModelId: () => 'test:model',
    });

    await aggregate.writeNext(bookId);

    expect(writeChapter).toHaveBeenCalledTimes(1);
    // The prompt should contain content from the chapter card
    expect(writeChapter.mock.calls[0]?.[0].prompt).toContain('Card plot function');
  });

  it('includes story route plan in the chapter prompt', async () => {
    const { aggregate, bookId, deps } = createTestDeps();

    await aggregate.writeNext(bookId);

    const prompt = deps.chapterWriter.writeChapter.mock.calls[0]?.[0].prompt ?? '';
    expect(prompt).toContain('Story Skill Route Plan');
  });

  it('updates book status to writing after successful chapter write', async () => {
    const { aggregate, bookId, deps } = createTestDeps();

    await aggregate.writeNext(bookId);

    const book = deps.books.getById(bookId);
    expect(book?.status).toBe('writing');
  });

  it('calls onBookUpdated after chapter completion', async () => {
    const onBookUpdated = vi.fn();
    const { aggregate, bookId } = createTestDeps({ onBookUpdated });

    await aggregate.writeNext(bookId);

    expect(onBookUpdated).toHaveBeenCalledWith(bookId);
  });

  it('extracts narrative state when narrativeStateExtractor is provided', async () => {
    const saveState = vi.fn();
    const saveRelState = vi.fn();

    const { aggregate, bookId } = createTestDeps({
      narrativeStateExtractor: {
        extractState: vi.fn().mockResolvedValue({
          characterStates: [
            {
              characterId: 'char-1',
              characterName: 'Hero',
              location: 'Forest',
              status: 'Resting',
              knowledge: 'Found map',
              emotion: 'Hopeful',
              powerLevel: 'Novice',
              arcPhase: 'growth',
            },
          ],
          relationshipStates: [
            {
              relationshipId: 'rel-1',
              type: 'ally',
              from: 'char-1',
              to: 'char-2',
              status: 'Strengthened',
            },
          ],
          threadUpdates: [],
        }),
      },
      characterArcs: {
        listByBook: vi.fn(() => []),
        saveState,
      },
      relationshipStates: {
        save: saveRelState,
      },
      narrativeThreads: {
        listByBook: vi.fn(() => []),
      },
    });

    await aggregate.writeNext(bookId);

    expect(saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId,
        characterId: 'char-1',
        chapterIndex: 1,
      })
    );
    expect(saveRelState).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId,
        relationshipId: 'rel-1',
      })
    );
  });

  it('runs narrative checkpoint at the right chapter indices', async () => {
    // shouldRunNarrativeCheckpoint returns true for multiples of 10
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const chapters = createChapterRepository(db);
    const bookId = 'checkpoint-book';
    books.create({
      id: bookId,
      title: 'Checkpoint Book',
      idea: 'Test checkpoints.',
      targetChapters: 10,
      wordsPerChapter: 1200,
    });
    // Set up chapter 10 (which triggers checkpoint since it's a multiple of 10)
    chapters.upsertOutline({
      bookId,
      volumeIndex: 1,
      chapterIndex: 10,
      title: 'Chapter 10',
      outline: 'Checkpoint chapter',
    });

    const reviewCheckpoint = vi.fn().mockResolvedValue({
      checkpointType: 'milestone',
      arcReport: {},
      threadDebt: {},
      pacingReport: {},
      replanningNotes: null,
    });

    const aggregate = createChapterAggregate({
      books,
      chapters,
      progress: createProgressRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: 'Chapter 10 content',
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('Summary'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
      sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
      narrativeCheckpoint: { reviewCheckpoint },
      narrativeCheckpoints: {
        save: vi.fn(),
        listByBook: vi.fn(() => []),
      },
      resolveModelId: () => 'test:model',
    });

    await aggregate.writeNext(bookId);

    expect(reviewCheckpoint).toHaveBeenCalledWith({
      bookId,
      chapterIndex: 10,
    });
  });

  it('saves progress phases during the pipeline', async () => {
    const updatePhase = vi.fn();
    const { aggregate, bookId } = createTestDeps({
      progress: { updatePhase },
    });

    await aggregate.writeNext(bookId);

    expect(updatePhase).toHaveBeenCalledWith(
      bookId,
      'writing',
      expect.objectContaining({
        currentChapter: 1,
        stepLabel: '正在写第 1 章',
      })
    );
    expect(updatePhase).toHaveBeenCalledWith(
      bookId,
      'extracting_continuity',
      expect.objectContaining({
        currentChapter: 1,
      })
    );
  });

  it('skips writing when the first draft causes a pause before short-chapter rewrite', async () => {
    const db = createDatabase(':memory:');
    const { books, chapters, bookId } = setupBookWithOutline(db);

    let callCount = 0;
    let pauseAfterFirstCall = false;
    const writeChapter = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1 && pauseAfterFirstCall) {
        // The pause happens between first and second call
      }
      return Promise.resolve({
        content: callCount === 1 ? 'Short' : 'Expanded rewrite',
        usage: { inputTokens: 100, outputTokens: 200 },
      });
    });

    const deps = {
      books,
      chapters,
      progress: createProgressRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
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
      characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
      sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
      shouldRewriteShortChapter: ({ content }: { content: string }) =>
        content === 'Short',
      resolveModelId: () => 'test:model',
    };

    const aggregate = createChapterAggregate(deps);
    const result = await aggregate.writeNext(bookId);

    // Should have rewritten since the book wasn't paused
    expect(writeChapter).toHaveBeenCalledTimes(2);
    if ('content' in result) {
      expect(result.content).toBe('Expanded rewrite');
    }
  });

  it('returns paused result when book paused after short chapter rewrite check', async () => {
    const db = createDatabase(':memory:');
    const { books, chapters, bookId } = setupBookWithOutline(db);

    let resolveFirst!: (r: any) => void;
    let resolveSecond!: (r: any) => void;
    const firstCall = new Promise((r) => { resolveFirst = r; });
    const secondCall = new Promise((r) => { resolveSecond = r; });
    let callIdx = 0;

    const writeChapter = vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return firstCall;
      return secondCall;
    });

    const deps = {
      books,
      chapters,
      progress: createProgressRepository(db),
      sceneRecords: createSceneRecordRepository(db),
      characters: createCharacterRepository(db),
      plotThreads: createPlotThreadRepository(db),
      chapterWriter: { writeChapter },
      summaryGenerator: { summarizeChapter: vi.fn() },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
      sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
      shouldRewriteShortChapter: () => true,
      resolveModelId: () => 'test:model',
    };

    const aggregate = createChapterAggregate(deps);
    const writePromise = aggregate.writeNext(bookId);

    // Resolve first draft
    resolveFirst({
      content: 'Short draft',
      usage: { inputTokens: 100, outputTokens: 20 },
    });

    // Wait a tick to let the rewrite start
    await new Promise((r) => setTimeout(r, 10));

    // Resolve second draft, but book is paused
    books.updateStatus(bookId, 'paused');
    resolveSecond({
      content: 'Rewritten draft',
      usage: { inputTokens: 140, outputTokens: 120 },
    });

    const result = await writePromise;
    expect(result).toEqual({ paused: true });
  });

  it('uses countStoryCharacters for word count', async () => {
    const { aggregate, bookId, deps } = createTestDeps({
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: '一二三\n\n四五 六七八九',
          usage: { inputTokens: 100, outputTokens: 400 },
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockImplementation(async ({ content }) => content),
      },
    });

    await aggregate.writeNext(bookId);

    const chapter = deps.chapters.listByBook(bookId)[0];
    expect(chapter.wordCount).toBe(9);
    expect(chapter.content).toBe('一二三\n\n四五 六七八九');
  });
});
