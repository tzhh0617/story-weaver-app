import type { NarrativeStateDelta, RelationshipStateInput } from '../../narrative/types.js';
import type { OutlineBundle } from '../../types.js';
import type { ProgressTrackerDeps } from './progress-tracker.js';
import { createProgressTracker } from './progress-tracker.js';

export type NarrativeStateWriterDeps = {
  narrativeStateExtractor?: {
    extractState: (input: {
      modelId: string;
      content: string;
    }) => Promise<NarrativeStateDelta>;
  };
  characterArcs?: {
    saveState?: (input: {
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
      arcPhase?: string | null;
    }) => void;
  };
  relationshipStates?: {
    save: (input: RelationshipStateInput) => void;
  };
  narrativeThreads?: {
    listByBook: (bookId: string) => NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'];
    upsertThread?: (
      bookId: string,
      thread: NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'][number]
    ) => void;
    resolveThread?: (bookId: string, threadId: string, resolvedAt: number) => void;
  };
} & ProgressTrackerDeps;

export function createNarrativeStateWriter(deps: NarrativeStateWriterDeps) {
  const { updateTrackedPhase } = createProgressTracker(deps);

  async function extractNarrativeState(input: {
    bookId: string;
    modelId: string;
    content: string;
    volumeIndex: number;
    chapterIndex: number;
  }): Promise<void> {
    if (deps.narrativeStateExtractor) {
      const stateStepLabel = `正在提取第 ${input.chapterIndex} 章叙事状态`;
      updateTrackedPhase({
        bookId: input.bookId,
        phase: 'extracting_state',
        stepLabel: stateStepLabel,
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
      });
      const delta = await deps.narrativeStateExtractor.extractState({
        modelId: input.modelId,
        content: input.content,
      });
      for (const state of delta.characterStates) {
        deps.characterArcs?.saveState?.({
          ...state,
          bookId: input.bookId,
          volumeIndex: input.volumeIndex,
          chapterIndex: input.chapterIndex,
        });
      }
      for (const state of delta.relationshipStates) {
        deps.relationshipStates?.save({
          ...state,
          bookId: input.bookId,
          volumeIndex: input.volumeIndex,
          chapterIndex: input.chapterIndex,
        });
      }
      for (const threadUpdate of delta.threadUpdates) {
        const existingThread = deps.narrativeThreads
          ?.listByBook(input.bookId)
          .find((thread) => thread.id === threadUpdate.threadId);
        if (existingThread && deps.narrativeThreads?.upsertThread) {
          deps.narrativeThreads.upsertThread(input.bookId, {
            ...existingThread,
            currentState: threadUpdate.currentState,
            resolvedAt: threadUpdate.resolvedAt ?? existingThread.resolvedAt,
            notes: threadUpdate.notes ?? existingThread.notes,
          });
        }
        if (threadUpdate.resolvedAt && deps.narrativeThreads?.resolveThread) {
          deps.narrativeThreads.resolveThread(
            input.bookId,
            threadUpdate.threadId,
            threadUpdate.resolvedAt
          );
        }
      }
    }
  }

  return { extractNarrativeState };
}
