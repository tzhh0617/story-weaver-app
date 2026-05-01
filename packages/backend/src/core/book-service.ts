import {
  createBookOrchestrator,
  type BookOrchestratorDeps,
} from './orchestrator.js';

export type { BookOrchestratorDeps };

export function createBookService(
  deps: BookOrchestratorDeps & {
    resolveModelId?: () => string;
    onBookUpdated?: (bookId: string) => void;
    onGenerationEvent?: (event: import('@story-weaver/shared/contracts').BookGenerationEvent) => void;
  }
) {
  return createBookOrchestrator(deps);
}
