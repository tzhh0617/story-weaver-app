import type { BookGenerationEvent } from '@story-weaver/shared/contracts';

export type ProgressTrackerDeps = {
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
  };
  onGenerationEvent?: (event: BookGenerationEvent) => void;
  onBookUpdated?: (bookId: string) => void;
};

export function createProgressTracker(deps: ProgressTrackerDeps) {
  function emitProgress(input: {
    bookId: string;
    phase: string;
    stepLabel: string;
    currentVolume?: number | null;
    currentChapter?: number | null;
  }) {
    deps.onGenerationEvent?.({
      bookId: input.bookId,
      type: 'progress',
      phase: input.phase,
      stepLabel: input.stepLabel,
      currentVolume: input.currentVolume ?? null,
      currentChapter: input.currentChapter ?? null,
    });
  }

  function updateTrackedPhase(input: {
    bookId: string;
    phase: string;
    stepLabel: string;
    currentVolume?: number | null;
    currentChapter?: number | null;
    notifyBookUpdated?: boolean;
  }) {
    deps.progress.updatePhase(input.bookId, input.phase, {
      currentVolume: input.currentVolume ?? null,
      currentChapter: input.currentChapter ?? null,
      stepLabel: input.stepLabel,
    });
    emitProgress(input);
    if (input.notifyBookUpdated) {
      deps.onBookUpdated?.(input.bookId);
    }
  }

  return { emitProgress, updateTrackedPhase };
}
