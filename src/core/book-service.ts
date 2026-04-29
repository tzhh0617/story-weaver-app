import { randomUUID } from 'node:crypto';
import type { BookGenerationEvent, BookStatus } from '../shared/contracts.js';
import { DEFAULT_MOCK_MODEL_ID } from '../models/runtime-mode.js';
import { buildStoredChapterContext } from './consistency.js';
import { buildChapterDraftPrompt } from './prompt-builder.js';
import {
  assertPositiveIntegerLimit,
  countStoryCharacters,
  normalizeChapterOutlinesToTarget,
} from './story-constraints.js';
import type { OutlineBundle, OutlineGenerationInput } from './types.js';

const CHAPTER_CONTEXT_MAX_CHARACTERS = 6000;
const INITIAL_BOOK_TITLE = '新作品';

function deriveTitleFromIdea(idea: string) {
  const cleaned = idea.trim().replace(/\s+/g, ' ');

  if (!cleaned) {
    return 'Untitled Story';
  }

  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}...` : cleaned;
}

type ChapterUpdate = {
  summary: string;
  openedThreads: Array<{
    id: string;
    description: string;
    plantedAt: number;
    expectedPayoff?: number | null;
    importance?: string | null;
  }>;
  resolvedThreadIds: string[];
  characterStates: Array<{
    characterId: string;
    characterName: string;
    location?: string | null;
    status?: string | null;
    knowledge?: string | null;
    emotion?: string | null;
    powerLevel?: string | null;
  }>;
  scene: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events?: string | null;
  } | null;
};

function hasUsableChapterUpdate(update: ChapterUpdate) {
  return update.summary.trim().length > 0;
}

function buildShortChapterRewritePrompt(input: {
  originalPrompt: string;
  wordsPerChapter: number;
  actualWordCount: number;
}) {
  return [
    input.originalPrompt,
    '',
    'Automatic review found this chapter too short.',
    `Generated effective word count: ${input.actualWordCount}`,
    `Soft target word count: approximately ${input.wordsPerChapter}`,
    'Start over from the original chapter brief and write a complete replacement draft. Preserve the same chapter title, outline, continuity, and story direction, but expand scenes, conflict, sensory detail, and emotional beats naturally.',
    'Do not summarize, do not explain the rewrite, and do not truncate the prose.',
  ].join('\n');
}

function saveChapterOutlines(
  deps: {
    chapters: {
      upsertOutline: (input: {
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        title: string;
        outline: string;
      }) => void;
    };
    onBookUpdated?: (bookId: string) => void;
  },
  bookId: string,
  chapterOutlines: OutlineBundle['chapterOutlines']
) {
  for (const chapter of chapterOutlines) {
    deps.chapters.upsertOutline({
      bookId,
      volumeIndex: chapter.volumeIndex,
      chapterIndex: chapter.chapterIndex,
      title: chapter.title,
      outline: chapter.outline,
    });
  }

  if (chapterOutlines.length) {
    deps.onBookUpdated?.(bookId);
  }
}

async function extractChapterUpdate(input: {
  modelId: string;
  chapterIndex: number;
  content: string;
  deps: Pick<
    Parameters<typeof createBookService>[0],
    | 'summaryGenerator'
    | 'plotThreadExtractor'
    | 'characterStateExtractor'
    | 'sceneRecordExtractor'
    | 'chapterUpdateExtractor'
  >;
}): Promise<ChapterUpdate> {
  if (input.deps.chapterUpdateExtractor) {
    try {
      const chapterUpdate =
        await input.deps.chapterUpdateExtractor.extractChapterUpdate({
          modelId: input.modelId,
          chapterIndex: input.chapterIndex,
          content: input.content,
        });

      if (hasUsableChapterUpdate(chapterUpdate)) {
        return chapterUpdate;
      }
    } catch {
      // Fall back to the older extractors so one malformed JSON response does not lose the chapter.
    }
  }

  const threadUpdates = await input.deps.plotThreadExtractor.extractThreads({
    modelId: input.modelId,
    chapterIndex: input.chapterIndex,
    content: input.content,
  });

  return {
    summary: await input.deps.summaryGenerator.summarizeChapter({
      modelId: input.modelId,
      content: input.content,
    }),
    openedThreads: threadUpdates.openedThreads,
    resolvedThreadIds: threadUpdates.resolvedThreadIds,
    characterStates: await input.deps.characterStateExtractor.extractStates({
      modelId: input.modelId,
      chapterIndex: input.chapterIndex,
      content: input.content,
    }),
    scene: await input.deps.sceneRecordExtractor.extractScene({
      modelId: input.modelId,
      chapterIndex: input.chapterIndex,
      content: input.content,
    }),
  };
}

export function createBookService(deps: {
  books: {
    create: (input: {
      id: string;
      title: string;
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
    }) => void;
    list: () => Array<{
      id: string;
      title: string;
      idea: string;
      status: string;
      targetChapters: number;
      wordsPerChapter: number;
      createdAt: string;
      updatedAt: string;
    }>;
    getById: (bookId: string) =>
      | {
          id: string;
          title: string;
          idea: string;
          status: string;
          targetChapters: number;
          wordsPerChapter: number;
          createdAt: string;
          updatedAt: string;
        }
      | undefined;
    updateStatus: (bookId: string, status: BookStatus) => void;
    updateTitle: (bookId: string, title: string) => void;
    delete: (bookId: string) => void;
    saveContext: (input: {
      bookId: string;
      worldSetting: string;
      outline: string;
      styleGuide?: string | null;
    }) => void;
    getContext: (bookId: string) =>
      | {
          bookId: string;
          worldSetting: string;
          outline: string;
          styleGuide: string | null;
        }
      | undefined;
  };
  chapters: {
    upsertOutline: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string;
      outline: string;
    }) => void;
    listByBook: (bookId: string) => Array<{
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string | null;
      outline: string | null;
      content: string | null;
      summary: string | null;
      wordCount: number;
    }>;
    saveContent: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      content: string;
      summary?: string | null;
      wordCount: number;
    }) => void;
    clearGeneratedContent: (bookId: string) => void;
    deleteByBook: (bookId: string) => void;
  };
  sceneRecords: {
    save: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      location: string;
      timeInStory: string;
      charactersPresent: string[];
      events?: string | null;
    }) => void;
    getLatestByBook: (bookId: string) =>
      | {
          bookId: string;
          volumeIndex: number;
          chapterIndex: number;
          location: string;
          timeInStory: string;
          charactersPresent: string[];
          events: string | null;
        }
      | null;
    clearByBook: (bookId: string) => void;
  };
  characters: {
    saveState: (input: {
      bookId: string;
      characterId: string;
      characterName: string;
      volumeIndex: number;
      chapterIndex: number;
      location?: string | null;
      status?: string | null;
      knowledge?: string | null;
      emotion?: string | null;
      powerLevel?: string | null;
    }) => void;
    listLatestStatesByBook: (bookId: string) => Array<{
      characterId: string;
      characterName: string;
      volumeIndex: number;
      chapterIndex: number;
      location: string | null;
      status: string | null;
      knowledge: string | null;
      emotion: string | null;
      powerLevel: string | null;
    }>;
    clearStatesByBook: (bookId: string) => void;
    deleteByBook: (bookId: string) => void;
  };
  plotThreads: {
    upsertThread: (input: {
      id: string;
      bookId: string;
      description: string;
      plantedAt: number;
      expectedPayoff?: number | null;
      resolvedAt?: number | null;
      importance?: string | null;
    }) => void;
    resolveThread: (id: string, resolvedAt: number) => void;
    listByBook: (bookId: string) => Array<{
      id: string;
      bookId: string;
      description: string;
      plantedAt: number;
      expectedPayoff: number | null;
      resolvedAt: number | null;
      importance: string;
    }>;
    clearByBook: (bookId: string) => void;
  };
  progress: {
    updatePhase: (
      bookId: string,
      phase: string,
      metadata?: {
        currentVolume?: number | null;
        currentChapter?: number | null;
        stepLabel?: string | null;
        errorMsg?: string | null;
      }
    ) => void;
    getByBookId: (bookId: string) =>
      | {
          bookId: string;
          currentVolume: number | null;
          currentChapter: number | null;
          phase: string | null;
          stepLabel: string | null;
          retryCount: number;
          errorMsg: string | null;
        }
      | undefined;
    reset: (bookId: string, phase: string) => void;
    deleteByBook: (bookId: string) => void;
  };
  outlineService: {
    generateTitleFromIdea?: (
      input: OutlineGenerationInput & { modelId: string }
    ) => Promise<string>;
    generateFromIdea: (
      input: OutlineGenerationInput & { modelId: string }
    ) => Promise<OutlineBundle>;
  };
  chapterWriter: {
    writeChapter: (input: {
      modelId: string;
      prompt: string;
      onChunk?: (chunk: string) => void;
    }) => Promise<{
      content: string;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
      };
    }>;
  };
  summaryGenerator: {
    summarizeChapter: (input: {
      modelId: string;
      content: string;
    }) => Promise<string>;
  };
  plotThreadExtractor: {
    extractThreads: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<{
      openedThreads: Array<{
        id: string;
        description: string;
        plantedAt: number;
        expectedPayoff?: number | null;
        importance?: string | null;
      }>;
      resolvedThreadIds: string[];
    }>;
  };
  characterStateExtractor: {
    extractStates: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<
      Array<{
        characterId: string;
        characterName: string;
        location?: string | null;
        status?: string | null;
        knowledge?: string | null;
        emotion?: string | null;
        powerLevel?: string | null;
      }>
    >;
  };
  sceneRecordExtractor: {
    extractScene: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<{
      location: string;
      timeInStory: string;
      charactersPresent: string[];
      events?: string | null;
    } | null>;
  };
  chapterUpdateExtractor?: {
    extractChapterUpdate: (input: {
      modelId: string;
      chapterIndex: number;
      content: string;
    }) => Promise<ChapterUpdate>;
  };
  shouldRewriteShortChapter?: (input: {
    content: string;
    wordsPerChapter: number;
  }) => boolean;
  resolveModelId?: () => string;
  onBookUpdated?: (bookId: string) => void;
  onGenerationEvent?: (event: BookGenerationEvent) => void;
}) {
  const resolveModelId = deps.resolveModelId ?? (() => DEFAULT_MOCK_MODEL_ID);

  return {
    createBook(input: {
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
      modelId?: string;
    }) {
      assertPositiveIntegerLimit(
        input.targetChapters,
        'Target chapters must be a positive integer'
      );
      assertPositiveIntegerLimit(
        input.wordsPerChapter,
        'Words per chapter must be a positive integer'
      );

      const id = randomUUID();

      deps.books.create({
        id,
        title: INITIAL_BOOK_TITLE,
        idea: input.idea,
        targetChapters: input.targetChapters,
        wordsPerChapter: input.wordsPerChapter,
      });

      deps.progress.updatePhase(id, 'creating');

      return id;
    },

    listBooks() {
      return deps.books.list();
    },

    getBookDetail(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        return null;
      }

      return {
        book,
        context: deps.books.getContext(bookId) ?? null,
        latestScene: deps.sceneRecords.getLatestByBook(bookId),
        characterStates: deps.characters.listLatestStatesByBook(bookId),
        plotThreads: deps.plotThreads.listByBook(bookId),
        chapters: deps.chapters.listByBook(bookId),
        progress: deps.progress.getByBookId(bookId) ?? null,
      };
    },

    async startBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'building_world');
      const modelId = resolveModelId();

      if (deps.outlineService.generateTitleFromIdea) {
        deps.progress.updatePhase(bookId, 'naming_title');
        deps.onBookUpdated?.(bookId);

        const generatedTitle = (
          await deps.outlineService.generateTitleFromIdea({
            bookId,
            idea: book.idea,
            targetChapters: book.targetChapters,
            wordsPerChapter: book.wordsPerChapter,
            modelId,
          })
        ).trim();

        if (!deps.books.getById(bookId)) {
          return;
        }

        deps.books.updateTitle(
          bookId,
          generatedTitle || deriveTitleFromIdea(book.idea)
        );
        deps.onBookUpdated?.(bookId);
      }

      deps.progress.updatePhase(bookId, 'building_world');
      deps.onBookUpdated?.(bookId);

      const outlineBundle = await deps.outlineService.generateFromIdea({
        bookId,
        idea: book.idea,
        targetChapters: book.targetChapters,
        wordsPerChapter: book.wordsPerChapter,
        modelId,
        onWorldSetting: (worldSetting) => {
          if (!deps.books.getById(bookId)) {
            return;
          }

          deps.progress.updatePhase(bookId, 'building_outline');
          deps.onBookUpdated?.(bookId);

          deps.books.saveContext({
            bookId,
            worldSetting,
            outline: '',
          });
          deps.onBookUpdated?.(bookId);
        },
        onMasterOutline: (masterOutline) => {
          const currentContext = deps.books.getContext(bookId);
          if (!deps.books.getById(bookId) || !currentContext) {
            return;
          }

          deps.progress.updatePhase(bookId, 'planning_chapters');
          deps.onBookUpdated?.(bookId);

          deps.books.saveContext({
            bookId,
            worldSetting: currentContext.worldSetting,
            outline: masterOutline,
          });
          deps.onBookUpdated?.(bookId);
        },
        onChapterOutlines: (chapterOutlines) => {
          if (!deps.books.getById(bookId)) {
            return;
          }

          saveChapterOutlines(deps, bookId, chapterOutlines);
        },
      });

      if (!deps.books.getById(bookId)) {
        return;
      }

      deps.books.saveContext({
        bookId,
        worldSetting: outlineBundle.worldSetting,
        outline: outlineBundle.masterOutline,
      });

      saveChapterOutlines(
        deps,
        bookId,
        normalizeChapterOutlinesToTarget(
          outlineBundle.chapterOutlines,
          book.targetChapters
        )
      );

      deps.books.updateStatus(bookId, 'building_outline');
      deps.progress.updatePhase(bookId, 'building_outline');
    },

    pauseBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'paused');
      deps.progress.updatePhase(bookId, 'paused');
    },

    async resumeBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.books.updateStatus(bookId, 'writing');
      deps.progress.updatePhase(bookId, 'writing');

      return this.writeRemainingChapters(bookId);
    },

    async writeNextChapter(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      const context = deps.books.getContext(bookId);
      const chapters = deps.chapters.listByBook(bookId);
      const nextChapter = chapters.find(
        (chapter) => chapter.outline && !chapter.content
      );

      if (!nextChapter || !nextChapter.outline || !nextChapter.title) {
        throw new Error('No outlined chapter available to write');
      }

      const nextChapterTitle = nextChapter.title;
      const modelId = resolveModelId();
      const prompt = buildChapterDraftPrompt({
        idea: book.idea,
        worldSetting: context?.worldSetting ?? null,
        masterOutline: context?.outline ?? null,
        continuityContext: buildStoredChapterContext({
          worldSetting: context?.worldSetting ?? null,
          characterStates: deps.characters.listLatestStatesByBook(bookId),
          plotThreads: deps.plotThreads.listByBook(bookId),
          latestScene: deps.sceneRecords.getLatestByBook(bookId),
          chapters,
          currentChapter: {
            volumeIndex: nextChapter.volumeIndex,
            chapterIndex: nextChapter.chapterIndex,
            outline: nextChapter.outline,
          },
          maxCharacters: CHAPTER_CONTEXT_MAX_CHARACTERS,
        }),
        chapterTitle: nextChapterTitle,
        chapterOutline: nextChapter.outline,
        targetChapters: book.targetChapters,
        wordsPerChapter: book.wordsPerChapter,
      });
      const writingStepLabel = `正在写第 ${nextChapter.chapterIndex} 章`;

      deps.progress.updatePhase(bookId, 'writing', {
        currentVolume: nextChapter.volumeIndex,
        currentChapter: nextChapter.chapterIndex,
        stepLabel: writingStepLabel,
      });
      deps.onGenerationEvent?.({
        bookId,
        type: 'progress',
        phase: 'writing',
        stepLabel: writingStepLabel,
        currentVolume: nextChapter.volumeIndex,
        currentChapter: nextChapter.chapterIndex,
      });

      let result = await deps.chapterWriter.writeChapter({
        modelId,
        prompt,
        onChunk: (delta) => {
          deps.onGenerationEvent?.({
            bookId,
            type: 'chapter-stream',
            volumeIndex: nextChapter.volumeIndex,
            chapterIndex: nextChapter.chapterIndex,
            title: nextChapterTitle,
            delta,
          });
        },
      });

      if (!deps.books.getById(bookId)) {
        return {
          deleted: true as const,
        };
      }

      if (
        deps.shouldRewriteShortChapter?.({
          content: result.content,
          wordsPerChapter: book.wordsPerChapter,
        })
      ) {
        const rewriteStepLabel = `正在重写第 ${nextChapter.chapterIndex} 章`;
        deps.progress.updatePhase(bookId, 'writing', {
          currentVolume: nextChapter.volumeIndex,
          currentChapter: nextChapter.chapterIndex,
          stepLabel: rewriteStepLabel,
        });
        deps.onGenerationEvent?.({
          bookId,
          type: 'progress',
          phase: 'writing',
          stepLabel: rewriteStepLabel,
          currentVolume: nextChapter.volumeIndex,
          currentChapter: nextChapter.chapterIndex,
        });

        let isFirstRewriteChunk = true;
        result = await deps.chapterWriter.writeChapter({
          modelId,
          prompt: buildShortChapterRewritePrompt({
            originalPrompt: prompt,
            wordsPerChapter: book.wordsPerChapter,
            actualWordCount: countStoryCharacters(result.content),
          }),
          onChunk: (delta) => {
            const streamEvent: BookGenerationEvent = {
              bookId,
              type: 'chapter-stream',
              volumeIndex: nextChapter.volumeIndex,
              chapterIndex: nextChapter.chapterIndex,
              title: nextChapterTitle,
              delta,
              ...(isFirstRewriteChunk ? { replace: true } : {}),
            };
            deps.onGenerationEvent?.(streamEvent);
            isFirstRewriteChunk = false;
          },
        });
      }

      if (!deps.books.getById(bookId)) {
        return {
          deleted: true as const,
        };
      }

      const postChapterStepLabel = `正在生成第 ${nextChapter.chapterIndex} 章摘要与连续性`;
      deps.progress.updatePhase(bookId, 'writing', {
        currentVolume: nextChapter.volumeIndex,
        currentChapter: nextChapter.chapterIndex,
        stepLabel: postChapterStepLabel,
      });
      deps.onGenerationEvent?.({
        bookId,
        type: 'progress',
        phase: 'writing',
        stepLabel: postChapterStepLabel,
        currentVolume: nextChapter.volumeIndex,
        currentChapter: nextChapter.chapterIndex,
      });

      const chapterUpdate = await extractChapterUpdate({
        modelId,
        chapterIndex: nextChapter.chapterIndex,
        content: result.content,
        deps,
      });

      if (!deps.books.getById(bookId)) {
        return {
          deleted: true as const,
        };
      }

      deps.chapters.saveContent({
        bookId,
        volumeIndex: nextChapter.volumeIndex,
        chapterIndex: nextChapter.chapterIndex,
        content: result.content,
        summary: chapterUpdate.summary,
        wordCount: countStoryCharacters(result.content),
      });

      for (const thread of chapterUpdate.openedThreads) {
        deps.plotThreads.upsertThread({
          id: thread.id,
          bookId,
          description: thread.description,
          plantedAt: thread.plantedAt,
          expectedPayoff: thread.expectedPayoff ?? null,
          importance: thread.importance ?? 'normal',
        });
      }

      for (const threadId of chapterUpdate.resolvedThreadIds) {
        deps.plotThreads.resolveThread(threadId, nextChapter.chapterIndex);
      }

      for (const state of chapterUpdate.characterStates) {
        deps.characters.saveState({
          bookId,
          characterId: state.characterId,
          characterName: state.characterName,
          volumeIndex: nextChapter.volumeIndex,
          chapterIndex: nextChapter.chapterIndex,
          location: state.location ?? null,
          status: state.status ?? null,
          knowledge: state.knowledge ?? null,
          emotion: state.emotion ?? null,
          powerLevel: state.powerLevel ?? null,
        });
      }

      if (chapterUpdate.scene) {
        deps.sceneRecords.save({
          bookId,
          volumeIndex: nextChapter.volumeIndex,
          chapterIndex: nextChapter.chapterIndex,
          location: chapterUpdate.scene.location,
          timeInStory: chapterUpdate.scene.timeInStory,
          charactersPresent: chapterUpdate.scene.charactersPresent,
          events: chapterUpdate.scene.events ?? null,
        });
      }

      const latestBook = deps.books.getById(bookId);
      if (!latestBook) {
        return {
          deleted: true as const,
        };
      }

      const nextPhase = latestBook?.status === 'paused' ? 'paused' : 'writing';

      deps.books.updateStatus(bookId, nextPhase);
      deps.progress.updatePhase(bookId, nextPhase, {
        currentVolume: nextChapter.volumeIndex,
        currentChapter: nextChapter.chapterIndex,
        stepLabel: postChapterStepLabel,
      });
      deps.onGenerationEvent?.({
        bookId,
        type: 'chapter-complete',
        volumeIndex: nextChapter.volumeIndex,
        chapterIndex: nextChapter.chapterIndex,
        title: nextChapterTitle,
      });
      deps.onBookUpdated?.(bookId);

      return result;
    },

    async writeRemainingChapters(bookId: string) {
      let completedChapters = 0;

      while (true) {
        const currentBook = deps.books.getById(bookId);
        if (!currentBook) {
          return {
            completedChapters,
            status: 'deleted' as const,
          };
        }

        if (currentBook.status === 'paused') {
          return {
            completedChapters,
            status: 'paused' as const,
          };
        }

        const nextChapter = deps.chapters
          .listByBook(bookId)
          .find((chapter) => chapter.outline && !chapter.content);

        if (!nextChapter) {
          break;
        }

        const result = await this.writeNextChapter(bookId);
        if (!deps.books.getById(bookId)) {
          return {
            completedChapters,
            status: 'deleted' as const,
          };
        }

        if ('deleted' in result && result.deleted) {
          return {
            completedChapters,
            status: 'deleted' as const,
          };
        }

        completedChapters += 1;
      }

      if (!deps.books.getById(bookId)) {
        return {
          completedChapters,
          status: 'deleted' as const,
        };
      }

      deps.books.updateStatus(bookId, 'completed');
      deps.progress.updatePhase(bookId, 'completed');
      deps.onBookUpdated?.(bookId);

      return {
        completedChapters,
        status: 'completed' as const,
      };
    },

    deleteBook(bookId: string) {
      if (!deps.books.getById(bookId)) {
        return;
      }

      deps.chapters.deleteByBook(bookId);
      deps.plotThreads.clearByBook(bookId);
      deps.characters.deleteByBook(bookId);
      deps.sceneRecords.clearByBook(bookId);
      deps.progress.deleteByBook(bookId);
      deps.books.delete(bookId);
    },

    async restartBook(bookId: string) {
      const book = deps.books.getById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      deps.chapters.clearGeneratedContent(bookId);
      deps.plotThreads.clearByBook(bookId);
      deps.characters.clearStatesByBook(bookId);
      deps.sceneRecords.clearByBook(bookId);
      deps.books.updateStatus(bookId, 'building_outline');
      deps.progress.reset(bookId, 'building_outline');

      return this.resumeBook(bookId);
    },
  };
}
