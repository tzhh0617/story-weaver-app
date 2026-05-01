import type { BookRecord } from '@story-weaver/shared/contracts';
import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
  NarrativeAudit,
  NarrativeStateDelta,
  RelationshipStateInput,
  ViralStoryProtocol,
} from './narrative/types.js';
import type { OutlineBundle, OutlineGenerationInput } from './types.js';
import type { ChapterUpdate } from './aggregates/chapter/chapter-aggregate.js';
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
