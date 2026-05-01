import type { OutlineBundle } from '../../types.js';
import type {
  CharacterStateInput,
  RelationshipStateInput,
} from '../../narrative/types.js';

type StoryBible = Omit<
  NonNullable<OutlineBundle['narrativeBible']>,
  'characterArcs' | 'relationshipEdges' | 'worldRules' | 'narrativeThreads'
>;

export type NarrativeWorldDeps = {
  storyBibles?: {
    saveGraph: (
      bookId: string,
      bible: NonNullable<OutlineBundle['narrativeBible']>
    ) => void;
    getByBook?: (bookId: string) => StoryBible | null;
  };
  characterArcs?: {
    listByBook: (
      bookId: string
    ) => NonNullable<OutlineBundle['narrativeBible']>['characterArcs'];
    saveState?: (input: CharacterStateInput) => void;
  };
  relationshipEdges?: {
    listByBook: (
      bookId: string
    ) => NonNullable<OutlineBundle['narrativeBible']>['relationshipEdges'];
  };
  relationshipStates?: {
    save: (input: RelationshipStateInput) => void;
  };
  worldRules?: {
    listByBook: (
      bookId: string
    ) => NonNullable<OutlineBundle['narrativeBible']>['worldRules'];
  };
  narrativeThreads?: {
    listByBook: (
      bookId: string
    ) => NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'];
    upsertThread?: (
      bookId: string,
      thread: NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'][number]
    ) => void;
    resolveThread?: (
      bookId: string,
      threadId: string,
      resolvedAt: number
    ) => void;
  };
};

export function createNarrativeWorldAggregate(deps: NarrativeWorldDeps) {
  return {
    getBible(bookId: string): StoryBible | null {
      return deps.storyBibles?.getByBook?.(bookId) ?? null;
    },

    listCharacterArcs(
      bookId: string
    ): NonNullable<OutlineBundle['narrativeBible']>['characterArcs'] {
      return deps.characterArcs?.listByBook(bookId) ?? [];
    },

    listRelationshipEdges(
      bookId: string
    ): NonNullable<OutlineBundle['narrativeBible']>['relationshipEdges'] {
      return deps.relationshipEdges?.listByBook(bookId) ?? [];
    },

    listWorldRules(
      bookId: string
    ): NonNullable<OutlineBundle['narrativeBible']>['worldRules'] {
      return deps.worldRules?.listByBook(bookId) ?? [];
    },

    listNarrativeThreads(
      bookId: string
    ): NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'] {
      return deps.narrativeThreads?.listByBook(bookId) ?? [];
    },

    loadBible(
      bookId: string,
      bible: NonNullable<OutlineBundle['narrativeBible']>
    ): void {
      deps.storyBibles?.saveGraph(bookId, bible);
    },

    saveCharacterArcState(input: CharacterStateInput): void {
      deps.characterArcs?.saveState?.(input);
    },

    saveRelationshipState(input: RelationshipStateInput): void {
      deps.relationshipStates?.save(input);
    },

    upsertNarrativeThread(
      bookId: string,
      thread: NonNullable<OutlineBundle['narrativeBible']>['narrativeThreads'][number]
    ): void {
      deps.narrativeThreads?.upsertThread?.(bookId, thread);
    },

    resolveNarrativeThread(
      bookId: string,
      threadId: string,
      resolvedAt: number
    ): void {
      deps.narrativeThreads?.resolveThread?.(bookId, threadId, resolvedAt);
    },
  };
}
