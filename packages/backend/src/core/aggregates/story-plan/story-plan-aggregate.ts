import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
  VolumePlan,
} from '../../narrative/types.js';
import type { OutlineBundle } from '../../types.js';

export type StoryPlanDeps = {
  volumePlans?: {
    upsertMany: (bookId: string, plans: VolumePlan[]) => void;
    listByBook?: (bookId: string) => VolumePlan[];
  };
  chapterCards?: {
    upsertMany: (cards: ChapterCard[]) => void;
    getNextUnwritten?: (bookId: string) => ChapterCard | null;
    listByBook?: (bookId: string) => ChapterCard[];
    upsertThreadActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterThreadAction[]
    ) => void;
    listThreadActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterThreadAction[];
    upsertCharacterPressures?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      pressures: ChapterCharacterPressure[]
    ) => void;
    listCharacterPressures?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterCharacterPressure[];
    upsertRelationshipActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterRelationshipAction[]
    ) => void;
    listRelationshipActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterRelationshipAction[];
  };
  chapterTensionBudgets?: {
    upsertMany: (budgets: ChapterTensionBudget[]) => void;
    getByChapter?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterTensionBudget | null;
    listByBook?: (bookId: string) => ChapterTensionBudget[];
  };
};

export function createStoryPlanAggregate(deps: StoryPlanDeps) {
  return {
    createFromBundle(bookId: string, bundle: OutlineBundle): void {
      if (bundle.volumePlans) {
        deps.volumePlans?.upsertMany(bookId, bundle.volumePlans);
      }
      if (bundle.chapterCards) {
        deps.chapterCards?.upsertMany(bundle.chapterCards);
      }
      if (bundle.chapterTensionBudgets?.length) {
        deps.chapterTensionBudgets?.upsertMany(bundle.chapterTensionBudgets);
      }

      for (const card of bundle.chapterCards ?? []) {
        const threadActions = (bundle.chapterThreadActions ?? []).filter(
          (action) =>
            action.volumeIndex === card.volumeIndex &&
            action.chapterIndex === card.chapterIndex
        );
        const characterPressures = (
          bundle.chapterCharacterPressures ?? []
        ).filter(
          (pressure) =>
            pressure.volumeIndex === card.volumeIndex &&
            pressure.chapterIndex === card.chapterIndex
        );
        const relationshipActions = (
          bundle.chapterRelationshipActions ?? []
        ).filter(
          (action) =>
            action.volumeIndex === card.volumeIndex &&
            action.chapterIndex === card.chapterIndex
        );

        deps.chapterCards?.upsertThreadActions?.(
          bookId,
          card.volumeIndex,
          card.chapterIndex,
          threadActions
        );
        deps.chapterCards?.upsertCharacterPressures?.(
          bookId,
          card.volumeIndex,
          card.chapterIndex,
          characterPressures
        );
        deps.chapterCards?.upsertRelationshipActions?.(
          bookId,
          card.volumeIndex,
          card.chapterIndex,
          relationshipActions
        );
      }
    },

    listChapterCards(bookId: string): ChapterCard[] {
      return deps.chapterCards?.listByBook?.(bookId) ?? [];
    },

    getNextUnwritten(bookId: string): ChapterCard | null {
      return deps.chapterCards?.getNextUnwritten?.(bookId) ?? null;
    },

    listTensionBudgets(bookId: string): ChapterTensionBudget[] {
      return deps.chapterTensionBudgets?.listByBook?.(bookId) ?? [];
    },

    getTensionBudgetByChapter(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterTensionBudget | null {
      return (
        deps.chapterTensionBudgets?.getByChapter?.(
          bookId,
          volumeIndex,
          chapterIndex
        ) ?? null
      );
    },

    listThreadActions(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterThreadAction[] {
      return (
        deps.chapterCards?.listThreadActions?.(
          bookId,
          volumeIndex,
          chapterIndex
        ) ?? []
      );
    },

    listCharacterPressures(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterCharacterPressure[] {
      return (
        deps.chapterCards?.listCharacterPressures?.(
          bookId,
          volumeIndex,
          chapterIndex
        ) ?? []
      );
    },

    listRelationshipActions(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterRelationshipAction[] {
      return (
        deps.chapterCards?.listRelationshipActions?.(
          bookId,
          volumeIndex,
          chapterIndex
        ) ?? []
      );
    },
  };
}
