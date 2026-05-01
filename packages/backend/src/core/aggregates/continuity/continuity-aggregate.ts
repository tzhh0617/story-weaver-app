export type ContinuityAggregateDeps = {
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
    clearByBook: (bookId: string) => void;
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
    clearStatesByBook: (bookId: string) => void;
  };
};

export type ChapterContinuityUpdate = {
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

export function createContinuityAggregate(deps: ContinuityAggregateDeps) {
  function updateFromChapter(
    bookId: string,
    volumeIndex: number,
    chapterIndex: number,
    update: ChapterContinuityUpdate
  ) {
    for (const thread of update.openedThreads) {
      deps.plotThreads.upsertThread({
        id: thread.id,
        bookId,
        description: thread.description,
        plantedAt: thread.plantedAt,
        expectedPayoff: thread.expectedPayoff ?? null,
        importance: thread.importance ?? 'normal',
      });
    }

    for (const threadId of update.resolvedThreadIds) {
      deps.plotThreads.resolveThread(bookId, threadId, chapterIndex);
    }

    for (const state of update.characterStates) {
      deps.characters.saveState({
        bookId,
        characterId: state.characterId,
        characterName: state.characterName,
        volumeIndex,
        chapterIndex,
        location: state.location ?? null,
        status: state.status ?? null,
        knowledge: state.knowledge ?? null,
        emotion: state.emotion ?? null,
        powerLevel: state.powerLevel ?? null,
      });
    }

    if (update.scene) {
      deps.sceneRecords.save({
        bookId,
        volumeIndex,
        chapterIndex,
        location: update.scene.location,
        timeInStory: update.scene.timeInStory,
        charactersPresent: update.scene.charactersPresent,
        events: update.scene.events ?? null,
      });
    }
  }

  function clearByBook(bookId: string) {
    deps.plotThreads.clearByBook(bookId);
    deps.sceneRecords.clearByBook(bookId);
    deps.characters.clearStatesByBook(bookId);
  }

  return {
    updateFromChapter,
    clearByBook,
  };
}
