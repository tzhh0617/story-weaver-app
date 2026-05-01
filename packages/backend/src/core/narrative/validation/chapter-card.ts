import type { ChapterCard, ValidationResult } from '../types.js';
import { isBlank, readerRewards, result } from './shared.js';

export function validateChapterCards(
  cards: ChapterCard[],
  input: { targetChapters: number }
): ValidationResult {
  const issues: string[] = [];
  const sorted = [...cards].sort((left, right) => left.chapterIndex - right.chapterIndex);
  const seenChapterIndexes = new Set<number>();

  for (const card of cards) {
    if (!Number.isInteger(card.chapterIndex) || card.chapterIndex <= 0) {
      issues.push(`Chapter card ${card.chapterIndex} must use a positive chapterIndex.`);
      continue;
    }
    if (card.chapterIndex > input.targetChapters) {
      issues.push(
        `Chapter card ${card.chapterIndex} exceeds target chapters ${input.targetChapters}.`
      );
    }
    if (seenChapterIndexes.has(card.chapterIndex)) {
      issues.push(`Chapter card ${card.chapterIndex} must not be duplicated.`);
    }
    seenChapterIndexes.add(card.chapterIndex);
  }

  for (let index = 0; index < input.targetChapters; index += 1) {
    const expectedChapter = index + 1;
    const card = sorted[index];
    if (!card || card.chapterIndex !== expectedChapter) {
      issues.push(`Chapter card ${expectedChapter} must exist.`);
      continue;
    }
    if (isBlank(card.title)) {
      issues.push(`Chapter ${expectedChapter} must include title.`);
    }
    if (isBlank(card.plotFunction)) {
      issues.push(`Chapter ${expectedChapter} must include plotFunction.`);
    }
    if (isBlank(card.externalConflict)) {
      issues.push(`Chapter ${expectedChapter} must include externalConflict.`);
    }
    if (isBlank(card.internalConflict)) {
      issues.push(`Chapter ${expectedChapter} must include internalConflict.`);
    }
    if (isBlank(card.relationshipChange)) {
      issues.push(`Chapter ${expectedChapter} must include relationshipChange.`);
    }
    if (isBlank(card.worldRuleUsedOrTested)) {
      issues.push(
        `Chapter ${expectedChapter} must include worldRuleUsedOrTested.`
      );
    }
    if (isBlank(card.informationReveal)) {
      issues.push(`Chapter ${expectedChapter} must include informationReveal.`);
    }
    if (isBlank(card.readerReward)) {
      issues.push(`Chapter ${expectedChapter} must include readerReward.`);
    } else if (!readerRewards.has(card.readerReward)) {
      issues.push(
        `Chapter ${expectedChapter} has invalid readerReward ${card.readerReward}.`
      );
    }
    if (isBlank(card.mustChange)) {
      issues.push(`Chapter ${expectedChapter} must include mustChange.`);
    }
    if (isBlank(card.endingHook)) {
      issues.push(`Chapter ${expectedChapter} must include endingHook.`);
    }
    if (!Array.isArray(card.forbiddenMoves)) {
      issues.push(`Chapter ${expectedChapter} must include forbiddenMoves array.`);
    }
  }

  return result(issues);
}
