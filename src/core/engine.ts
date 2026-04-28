import type { BookStatus } from '../shared/contracts.js';

type EngineResultStatus = 'completed' | 'paused' | 'deleted';

export function createNovelEngine(deps: {
  bookId: string;
  buildOutline: (bookId: string) => Promise<void>;
  continueWriting: (bookId: string) => Promise<{
    completedChapters: number;
    status: EngineResultStatus;
  }>;
  isBookActive?: (bookId: string) => boolean;
  repositories: {
    progress: {
      updatePhase: (bookId: string, phase: string) => void;
    };
  };
}) {
  let status: BookStatus | 'deleted' = 'creating';

  return {
    async start() {
      status = 'building_world';
      deps.repositories.progress.updatePhase(deps.bookId, status);
      await deps.buildOutline(deps.bookId);

      if (deps.isBookActive && !deps.isBookActive(deps.bookId)) {
        status = 'deleted';
        return;
      }

      status = 'writing';
      deps.repositories.progress.updatePhase(deps.bookId, status);

      const result = await deps.continueWriting(deps.bookId);

      if (result.status === 'deleted') {
        status = 'deleted';
        return;
      }

      if (result.status === 'paused') {
        status = 'paused';
        deps.repositories.progress.updatePhase(deps.bookId, status);
        return;
      }

      status = 'completed';
      deps.repositories.progress.updatePhase(deps.bookId, status);
    },

    getStatus() {
      return status;
    },
  };
}
