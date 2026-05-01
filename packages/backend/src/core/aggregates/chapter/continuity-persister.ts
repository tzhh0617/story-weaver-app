import { countStoryCharacters } from '../../story-constraints.js';
import { hasUsableChapterUpdate } from './chapter-types.js';
import type { ChapterUpdate } from './chapter-types.js';
import type { ProgressTrackerDeps } from './progress-tracker.js';
import { createProgressTracker } from './progress-tracker.js';

export type ContinuityPersisterDeps = {
  books: {
    getById: (bookId: string) => { id: string } | undefined;
  };
  chapters: {
    saveContent: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      content: string;
      summary?: string | null;
      wordCount: number;
      auditScore?: number | null;
      draftAttempts?: number;
    }) => void;
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
    resolveThread: (bookId: string, id: string, resolvedAt: number) => void;
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
} & ProgressTrackerDeps;

export function createContinuityPersister(deps: ContinuityPersisterDeps) {
  const { updateTrackedPhase } = createProgressTracker(deps);

  async function extractChapterUpdate(input: {
    modelId: string;
    chapterIndex: number;
    content: string;
  }): Promise<ChapterUpdate> {
    if (deps.chapterUpdateExtractor) {
      try {
        const chapterUpdate =
          await deps.chapterUpdateExtractor.extractChapterUpdate({
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

    const threadUpdates = await deps.plotThreadExtractor.extractThreads({
      modelId: input.modelId,
      chapterIndex: input.chapterIndex,
      content: input.content,
    });

    return {
      summary: await deps.summaryGenerator.summarizeChapter({
        modelId: input.modelId,
        content: input.content,
      }),
      openedThreads: threadUpdates.openedThreads,
      resolvedThreadIds: threadUpdates.resolvedThreadIds,
      characterStates: await deps.characterStateExtractor.extractStates({
        modelId: input.modelId,
        chapterIndex: input.chapterIndex,
        content: input.content,
      }),
      scene: await deps.sceneRecordExtractor.extractScene({
        modelId: input.modelId,
        chapterIndex: input.chapterIndex,
        content: input.content,
      }),
    };
  }

  async function extractAndSaveContinuity(input: {
    bookId: string;
    modelId: string;
    content: string;
    volumeIndex: number;
    chapterIndex: number;
    auditScore: number | null;
    draftAttempts: number;
  }): Promise<{ deleted: boolean }> {
    const postChapterStepLabel = `正在生成第 ${input.chapterIndex} 章摘要与连续性`;
    updateTrackedPhase({
      bookId: input.bookId,
      phase: 'extracting_continuity',
      stepLabel: postChapterStepLabel,
      currentVolume: input.volumeIndex,
      currentChapter: input.chapterIndex,
    });

    const chapterUpdate = await extractChapterUpdate({
      modelId: input.modelId,
      chapterIndex: input.chapterIndex,
      content: input.content,
    });

    if (!deps.books.getById(input.bookId)) {
      return {
        deleted: true as const,
      };
    }

    deps.chapters.saveContent({
      bookId: input.bookId,
      volumeIndex: input.volumeIndex,
      chapterIndex: input.chapterIndex,
      content: input.content,
      summary: chapterUpdate.summary,
      wordCount: countStoryCharacters(input.content),
      auditScore: input.auditScore,
      draftAttempts: input.draftAttempts,
    });

    for (const thread of chapterUpdate.openedThreads) {
      deps.plotThreads.upsertThread({
        id: thread.id,
        bookId: input.bookId,
        description: thread.description,
        plantedAt: thread.plantedAt,
        expectedPayoff: thread.expectedPayoff ?? null,
        importance: thread.importance ?? 'normal',
      });
    }

    for (const threadId of chapterUpdate.resolvedThreadIds) {
      deps.plotThreads.resolveThread(input.bookId, threadId, input.chapterIndex);
    }

    for (const state of chapterUpdate.characterStates) {
      deps.characters.saveState({
        bookId: input.bookId,
        characterId: state.characterId,
        characterName: state.characterName,
        volumeIndex: input.volumeIndex,
        chapterIndex: input.chapterIndex,
        location: state.location ?? null,
        status: state.status ?? null,
        knowledge: state.knowledge ?? null,
        emotion: state.emotion ?? null,
        powerLevel: state.powerLevel ?? null,
      });
    }

    if (chapterUpdate.scene) {
      deps.sceneRecords.save({
        bookId: input.bookId,
        volumeIndex: input.volumeIndex,
        chapterIndex: input.chapterIndex,
        location: chapterUpdate.scene.location,
        timeInStory: chapterUpdate.scene.timeInStory,
        charactersPresent: chapterUpdate.scene.charactersPresent,
        events: chapterUpdate.scene.events ?? null,
      });
    }

    return { deleted: false };
  }

  return { extractAndSaveContinuity };
}
