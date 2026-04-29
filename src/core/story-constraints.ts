import type { ChapterOutline } from './types.js';

function coercePositiveInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function isUsableChapterOutline(
  chapter: ChapterOutline
): chapter is ChapterOutline {
  return (
    Number.isFinite(chapter.volumeIndex) &&
    chapter.volumeIndex > 0 &&
    Number.isFinite(chapter.chapterIndex) &&
    chapter.chapterIndex > 0
  );
}

function buildMissingChapterOutlines(
  existing: ChapterOutline[],
  targetChapters: number
): ChapterOutline[] {
  const missingCount = targetChapters - existing.length;
  if (missingCount <= 0) {
    return [];
  }

  const lastChapter = existing.at(-1);
  const volumeIndex = lastChapter?.volumeIndex ?? 1;

  return Array.from({ length: missingCount }, (_, index) => {
    const chapterNumber = existing.length + index + 1;

    return {
      volumeIndex,
      chapterIndex: chapterNumber,
      title: `第${chapterNumber}章`,
      outline: `承接前文冲突推进第${chapterNumber}章，保持主线、人物状态和伏笔回收节奏。`,
    };
  });
}

export function normalizeChapterOutlinesToTarget(
  chapterOutlines: ChapterOutline[],
  targetChapters: number
) {
  const targetCount = coercePositiveInteger(targetChapters);
  const normalized = ensureUniqueChapterOutlineKeys(
    chapterOutlines.filter(isUsableChapterOutline).slice(0, targetCount)
  );

  return [
    ...normalized,
    ...buildMissingChapterOutlines(normalized, targetCount),
  ];
}

export function ensureUniqueChapterOutlineKeys(
  chapterOutlines: ChapterOutline[]
) {
  return chapterOutlines
    .filter(isUsableChapterOutline)
    .map((chapter, index) => ({
      ...chapter,
      volumeIndex: Math.floor(chapter.volumeIndex),
      chapterIndex: index + 1,
    }));
}

export function renumberChapterOutlinesFrom(
  chapterOutlines: ChapterOutline[],
  startChapterIndex: number
) {
  const firstChapterIndex = coercePositiveInteger(startChapterIndex);

  return chapterOutlines.filter(isUsableChapterOutline).map((chapter, index) => ({
    ...chapter,
    volumeIndex: Math.floor(chapter.volumeIndex),
    chapterIndex: firstChapterIndex + index,
  }));
}

export function takeChapterOutlinesWithinTarget(input: {
  chapterOutlines: ChapterOutline[];
  emittedCount: number;
  targetChapters: number;
}) {
  const targetCount = coercePositiveInteger(input.targetChapters);
  const remainingCount = Math.max(0, targetCount - input.emittedCount);

  return input.chapterOutlines
    .filter(isUsableChapterOutline)
    .slice(0, remainingCount);
}

export function countStoryCharacters(text: string) {
  let count = 0;

  for (const character of text) {
    if (!/\s/u.test(character)) {
      count += 1;
    }
  }

  return count;
}

export function assertPositiveIntegerLimit(
  value: number,
  errorMessage: string
) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(errorMessage);
  }
}
