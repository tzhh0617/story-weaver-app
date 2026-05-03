import type { NarrativeStateDelta } from './types.js';

export function detectMilestone(chapterIndex: number) {
  if (chapterIndex <= 0) {
    return null;
  }

  if (chapterIndex % 200 === 0) {
    return 200;
  }

  if (chapterIndex % 50 === 0) {
    return 50;
  }

  if (chapterIndex % 10 === 0) {
    return 10;
  }

  return null;
}

export function calculateRemainingChapterBudget(
  targetChapters: number,
  completedChapters: number
) {
  return Math.max(0, targetChapters - completedChapters);
}

export function normalizeNarrativeStateDelta(
  input: Partial<NarrativeStateDelta>
): NarrativeStateDelta {
  return {
    characterStates: Array.isArray(input.characterStates)
      ? input.characterStates
      : [],
    relationshipStates: Array.isArray(input.relationshipStates)
      ? input.relationshipStates
      : [],
    threadUpdates: Array.isArray(input.threadUpdates) ? input.threadUpdates : [],
    scene: input.scene ?? null,
    themeProgression: input.themeProgression ?? '',
  };
}
