import type {
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterThreadAction,
} from '../../narrative/types.js';
import { normalizeChapterOutlinesToTarget } from '../../story-constraints.js';
import type { OutlineBundle } from '../../types.js';

type BundleSaverDeps = {
  books: {
    saveContext: (input: {
      bookId: string;
      worldSetting: string;
      outline: string;
      styleGuide?: string | null;
    }) => void;
    onBookUpdated?: (bookId: string) => void;
  };
  chapters: {
    upsertOutline: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string;
      outline: string;
    }) => void;
  };
  storyBibles?: {
    saveGraph: (
      bookId: string,
      bible: NonNullable<OutlineBundle['narrativeBible']>
    ) => void;
  };
  volumePlans?: {
    upsertMany: (bookId: string, plans: NonNullable<OutlineBundle['volumePlans']>) => void;
  };
  chapterCards?: {
    upsertMany: (cards: NonNullable<OutlineBundle['chapterCards']>) => void;
    upsertThreadActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterThreadAction[]
    ) => void;
    upsertCharacterPressures?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      pressures: ChapterCharacterPressure[]
    ) => void;
    upsertRelationshipActions?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number,
      actions: ChapterRelationshipAction[]
    ) => void;
  };
  chapterTensionBudgets?: {
    upsertMany: (budgets: import('../../narrative/types.js').ChapterTensionBudget[]) => void;
  };
};

function saveChapterOutlines(
  deps: {
    chapters: {
      upsertOutline: (input: {
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        title: string;
        outline: string;
      }) => void;
    };
    onBookUpdated?: (bookId: string) => void;
  },
  bookId: string,
  chapterOutlines: OutlineBundle['chapterOutlines']
) {
  for (const chapter of chapterOutlines) {
    deps.chapters.upsertOutline({
      bookId,
      volumeIndex: chapter.volumeIndex,
      chapterIndex: chapter.chapterIndex,
      title: chapter.title,
      outline: chapter.outline,
    });
  }

  if (chapterOutlines.length) {
    deps.onBookUpdated?.(bookId);
  }
}

export function saveOutlineBundle(
  deps: BundleSaverDeps,
  input: {
    bookId: string;
    bundle: OutlineBundle;
    targetChapters: number;
  }
) {
  const { bookId, bundle, targetChapters } = input;

  deps.books.saveContext({
    bookId,
    worldSetting: bundle.worldSetting,
    outline: bundle.masterOutline,
  });

  if (bundle.narrativeBible) {
    deps.storyBibles?.saveGraph(bookId, bundle.narrativeBible);
  }
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

  saveChapterOutlines(
    deps,
    bookId,
    normalizeChapterOutlinesToTarget(bundle.chapterOutlines, targetChapters)
  );
}
