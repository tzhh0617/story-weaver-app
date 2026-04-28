import { randomUUID } from 'node:crypto';
import type { BookStatus } from '../shared/contracts.js';
import type { OutlineBundle } from './types.js';

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
  chapterTitle: string;
  chapterOutline: string;
}) {
  return [
    'Write the next chapter of a long-form Chinese web novel.',
    `Book idea: ${input.idea}`,
    `World setting:\n${input.worldSetting ?? 'N/A'}`,
    `Master outline:\n${input.masterOutline ?? 'N/A'}`,
    `Chapter title: ${input.chapterTitle}`,
    `Chapter outline: ${input.chapterOutline}`,
    'Return only the final chapter prose.',
  ].join('\n');
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
  resolveModelId?: () => string;
}) {
  const resolveModelId = deps.resolveModelId ?? (() => 'development:fallback');

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
      const nextChapter = deps.chapters
        .listByBook(bookId)
        .find((chapter) => chapter.outline && !chapter.content);

      if (!nextChapter || !nextChapter.outline || !nextChapter.title) {
        throw new Error('No outlined chapter available to write');
      }

      const result = await deps.chapterWriter.writeChapter({
        modelId: resolveModelId(),
        prompt: buildChapterDraftPrompt({
          idea: book.idea,
          worldSetting: context?.worldSetting ?? null,
          masterOutline: context?.outline ?? null,
          chapterTitle: nextChapter.title,
          chapterOutline: nextChapter.outline,
        }),
      });

      if (!deps.books.getById(bookId)) {
        return {
          deleted: true as const,
        };
      }

      const summary = await deps.summaryGenerator.summarizeChapter({
        modelId: resolveModelId(),
        content: result.content,
      });
      const threadUpdates = await deps.plotThreadExtractor.extractThreads({
        modelId: resolveModelId(),
        chapterIndex: nextChapter.chapterIndex,
        content: result.content,
      });
      const characterStates = await deps.characterStateExtractor.extractStates({
        modelId: resolveModelId(),
        chapterIndex: nextChapter.chapterIndex,
        content: result.content,
      });
      const latestScene = await deps.sceneRecordExtractor.extractScene({
        modelId: resolveModelId(),
        chapterIndex: nextChapter.chapterIndex,
        content: result.content,
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
        summary,
        wordCount: result.content.length,
      });

      for (const thread of threadUpdates.openedThreads) {
        deps.plotThreads.upsertThread({
          id: thread.id,
          bookId,
          description: thread.description,
          plantedAt: thread.plantedAt,
          expectedPayoff: thread.expectedPayoff ?? null,
          importance: thread.importance ?? 'normal',
        });
      }

      for (const threadId of threadUpdates.resolvedThreadIds) {
        deps.plotThreads.resolveThread(threadId, nextChapter.chapterIndex);
      }

      for (const state of characterStates) {
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

      if (latestScene) {
        deps.sceneRecords.save({
          bookId,
          volumeIndex: nextChapter.volumeIndex,
          chapterIndex: nextChapter.chapterIndex,
          location: latestScene.location,
          timeInStory: latestScene.timeInStory,
          charactersPresent: latestScene.charactersPresent,
          events: latestScene.events ?? null,
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
