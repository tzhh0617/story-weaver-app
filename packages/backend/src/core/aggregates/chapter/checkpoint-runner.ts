import {
  buildTensionCheckpoint,
  shouldRunNarrativeCheckpoint,
} from '../../narrative/checkpoint.js';
import type {
  ChapterTensionBudget,
  NarrativeAudit,
} from '../../narrative/types.js';
import type { ProgressTrackerDeps } from './progress-tracker.js';
import { createProgressTracker } from './progress-tracker.js';

export type CheckpointRunnerDeps = {
  narrativeCheckpoint?: {
    reviewCheckpoint: (input: {
      bookId: string;
      chapterIndex: number;
    }) => Promise<{
      checkpointType: string;
      arcReport: unknown;
      threadDebt: unknown;
      pacingReport: unknown;
      replanningNotes: string | null;
    }>;
  };
  narrativeCheckpoints?: {
    save: (input: {
      bookId: string;
      chapterIndex: number;
      report?: unknown;
      checkpointType?: string;
      arcReport?: unknown;
      threadDebt?: unknown;
      pacingReport?: unknown;
      replanningNotes?: string | null;
      futureCardRevisions?: unknown[];
    }) => void;
  };
  chapterTensionBudgets?: {
    listByBook?: (bookId: string) => ChapterTensionBudget[];
  };
  chapterAudits?: {
    listLatestByBook?: (bookId: string) => Array<{
      volumeIndex: number;
      chapterIndex: number;
      attempt: number;
      score?: number;
      decision?: NarrativeAudit['decision'];
      issues?: NarrativeAudit['issues'];
      scoring: NarrativeAudit['scoring'];
    }>;
  };
} & ProgressTrackerDeps;

export function createCheckpointRunner(deps: CheckpointRunnerDeps) {
  const { emitProgress } = createProgressTracker(deps);

  async function runCheckpoint(input: {
    bookId: string;
    volumeIndex: number;
    chapterIndex: number;
  }): Promise<void> {
    if (
      deps.narrativeCheckpoint &&
      deps.narrativeCheckpoints &&
      shouldRunNarrativeCheckpoint(input.chapterIndex)
    ) {
      const checkpointStepLabel = `正在复盘第 ${input.chapterIndex} 章叙事状态`;
      deps.progress.updatePhase(input.bookId, 'checkpoint_review', {
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
        stepLabel: checkpointStepLabel,
      });
      emitProgress({
        bookId: input.bookId,
        phase: 'checkpoint_review',
        stepLabel: checkpointStepLabel,
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
      });
      const checkpoint = await deps.narrativeCheckpoint.reviewCheckpoint({
        bookId: input.bookId,
        chapterIndex: input.chapterIndex,
      });
      const tensionCheckpoint =
        deps.chapterTensionBudgets?.listByBook &&
        deps.chapterAudits?.listLatestByBook
          ? buildTensionCheckpoint({
              chapterIndex: input.chapterIndex,
              budgets: deps.chapterTensionBudgets.listByBook(input.bookId),
              audits: deps.chapterAudits.listLatestByBook(input.bookId),
            })
          : null;
      deps.narrativeCheckpoints.save({
        bookId: input.bookId,
        chapterIndex: input.chapterIndex,
        ...(tensionCheckpoint
          ? {
              report: {
                ...checkpoint,
                tensionCheckpoint,
              },
              futureCardRevisions: [
                {
                  type: 'tension_budget_rebalance',
                  instruction: tensionCheckpoint.nextBudgetInstruction,
                },
              ],
            }
          : checkpoint),
      });
    }
  }

  return { runCheckpoint };
}
