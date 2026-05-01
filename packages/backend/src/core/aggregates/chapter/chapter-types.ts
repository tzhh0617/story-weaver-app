import type { ChapterCard } from '../../narrative/types.js';

export const CHAPTER_CONTEXT_MAX_CHARACTERS = 6000;

export type ChapterUpdate = {
  summary: string;
  openedThreads: Array<{
    id: string;
    description: string;
    plantedAt: number;
    expectedPayoff?: number | null;
    importance?: string | null;
  }>;
  resolvedThreadIds: string[];
  characterStates: Array<{
    characterId: string;
    characterName: string;
    location?: string | null;
    status?: string | null;
    knowledge?: string | null;
    emotion?: string | null;
    powerLevel?: string | null;
  }>;
  scene: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events?: string | null;
  } | null;
};

export function hasUsableChapterUpdate(update: ChapterUpdate) {
  return update.summary.trim().length > 0;
}

export function buildShortChapterRewritePrompt(input: {
  originalPrompt: string;
  wordsPerChapter: number;
  actualWordCount: number;
}) {
  return [
    input.originalPrompt,
    '',
    'Automatic review found this chapter too short.',
    `Generated effective word count: ${input.actualWordCount}`,
    `Soft target word count: approximately ${input.wordsPerChapter}`,
    'Start over from the original chapter brief and write a complete replacement draft. Preserve the same chapter identity, outline, continuity, and story direction, but expand scenes, conflict, sensory detail, and emotional beats naturally.',
    'Do not include any chapter title, heading, Markdown title, or title line in the body text.',
    'Do not summarize, do not explain the rewrite, and do not truncate the prose.',
  ].join('\n');
}

export function buildOutlineFromChapterCard(card: ChapterCard) {
  return [
    card.plotFunction,
    `必须变化：${card.mustChange}`,
    `外部冲突：${card.externalConflict}`,
    `内部冲突：${card.internalConflict}`,
    `关系变化：${card.relationshipChange}`,
    `章末钩子：${card.endingHook}`,
  ]
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}
