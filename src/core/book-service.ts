import { randomUUID } from 'node:crypto';
import type { BookStatus } from '../shared/contracts.js';
import { DEFAULT_MOCK_MODEL_ID } from '../models/runtime-mode.js';
import { buildStoredChapterContext } from './consistency.js';
import type { OutlineBundle } from './types.js';

const CHAPTER_CONTEXT_MAX_CHARACTERS = 6000;
const WORLD_SETTING_MAX_CHARACTERS = 3000;
const MASTER_OUTLINE_MAX_CHARACTERS = 3000;

function trimPromptText(text: string | null, maxCharacters: number) {
  if (!text) {
    return 'N/A';
  }

  if (text.length <= maxCharacters) {
    return text;
  }

  return `${text.slice(0, maxCharacters)}\n[truncated]`;
}

function deriveTitleFromIdea(idea: string) {
  const cleaned = idea.trim().replace(/\s+/g, ' ');

  if (!cleaned) {
    return 'Untitled Story';
  }

  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}...` : cleaned;
}

function buildChapterDraftPrompt(input: {
  idea: string;
  worldSetting: string | null;
  masterOutline: string | null;
  continuityContext: string | null;
  chapterTitle: string;
  chapterOutline: string;
}) {
  return [
    'Write the next chapter of a long-form Chinese web novel.',
    `Book idea: ${input.idea}`,
    `World setting:\n${trimPromptText(
      input.worldSetting,
      WORLD_SETTING_MAX_CHARACTERS
    )}`,
    `Master outline:\n${trimPromptText(
      input.masterOutline,
      MASTER_OUTLINE_MAX_CHARACTERS
    )}`,
    `Continuity context:\n${input.continuityContext ?? 'N/A'}`,
    'Treat the continuity context as hard constraints: do not contradict character states, last scene timing/location, unresolved plot threads, or established world rules.',
    `Chapter title: ${input.chapterTitle}`,
    `Chapter outline: ${input.chapterOutline}`,
    'Return only the final chapter prose.',
  ].join('\n');
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
      targetWords: number;
    }) => void;
    list: () => Array<{
      id: string;
      title: string;
      idea: string;
      status: string;
      targetWords: number;
      createdAt: string;
      updatedAt: string;
    }>;
    getById: (bookId: string) =>
      | {
          id: string;
          title: string;
          idea: string;
          status: string;
          targetWords: number;
          createdAt: string;
          updatedAt: string;
        }
      | undefined;
    updateStatus: (bookId: string, status: BookStatus) => void;
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
    updatePhase: (bookId: string, phase: string) => void;
    getByBookId: (bookId: string) =>
      | {
          bookId: string;
          currentVolume: number | null;
          currentChapter: number | null;
          phase: string | null;
          retryCount: number;
          errorMsg: string | null;
        }
      | undefined;
    reset: (bookId: string, phase: string) => void;
    deleteByBook: (bookId: string) => void;
  };
  outlineService: {
    generateFromIdea: (input: {
      bookId: string;
      idea: string;
      targetWords: number;
      modelId: string;
    }) => Promise<OutlineBundle>;
  };
  chapterWriter: {
    writeChapter: (input: {
      modelId: string;
      prompt: string;
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
  resolveModelId?: () => string;
}) {
  const resolveModelId = deps.resolveModelId ?? (() => DEFAULT_MOCK_MODEL_ID);

  return {
    createBook(input: {
      idea: string;
      targetWords: number;
      modelId?: string;
    }) {
      const id = randomUUID();

      deps.books.create({
        id,
        title: deriveTitleFromIdea(input.idea),
        idea: input.idea,
        targetWords: input.targetWords,
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
      deps.progress.updatePhase(bookId, 'building_world');

      const outlineBundle = await deps.outlineService.generateFromIdea({
        bookId,
        idea: book.idea,
        targetWords: book.targetWords,
        modelId: resolveModelId(),
      });

      if (!deps.books.getById(bookId)) {
        return;
      }

      deps.books.saveContext({
        bookId,
        worldSetting: outlineBundle.worldSetting,
        outline: outlineBundle.masterOutline,
      });

      for (const chapter of outlineBundle.chapterOutlines) {
        deps.chapters.upsertOutline({
          bookId,
          volumeIndex: chapter.volumeIndex,
          chapterIndex: chapter.chapterIndex,
          title: chapter.title,
          outline: chapter.outline,
        });
      }

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

      const modelId = resolveModelId();
      const result = await deps.chapterWriter.writeChapter({
        modelId,
        prompt: buildChapterDraftPrompt({
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
          chapterTitle: nextChapter.title,
          chapterOutline: nextChapter.outline,
        }),
      });

      if (!deps.books.getById(bookId)) {
        return {
          deleted: true as const,
        };
      }

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
        wordCount: result.content.length,
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
      deps.progress.updatePhase(bookId, nextPhase);

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
