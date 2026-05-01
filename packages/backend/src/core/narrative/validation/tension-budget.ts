import type { ChapterTensionBudget, ValidationResult } from '../types.js';
import { dominantTensions, isBlank, result, tensionPressureLevels } from './shared.js';

export function validateTensionBudgets(
  budgets: ChapterTensionBudget[],
  input: { targetChapters: number }
): ValidationResult {
  const issues: string[] = [];
  const sorted = [...budgets].sort(
    (left, right) => left.chapterIndex - right.chapterIndex
  );
  let repeatedTensionCount = 0;
  let previousDominantTension: string | null = null;
  const seenChapterIndexes = new Set<number>();

  for (const budget of budgets) {
    if (!Number.isInteger(budget.chapterIndex) || budget.chapterIndex <= 0) {
      issues.push(
        `Tension budget ${budget.chapterIndex} must use a positive chapterIndex.`
      );
      continue;
    }
    if (budget.chapterIndex > input.targetChapters) {
      issues.push(
        `Tension budget ${budget.chapterIndex} exceeds target chapters ${input.targetChapters}.`
      );
    }
    if (seenChapterIndexes.has(budget.chapterIndex)) {
      issues.push(`Tension budget ${budget.chapterIndex} must not be duplicated.`);
    }
    seenChapterIndexes.add(budget.chapterIndex);
  }

  for (let index = 0; index < input.targetChapters; index += 1) {
    const expectedChapter = index + 1;
    const budget = sorted[index];

    if (!budget || budget.chapterIndex !== expectedChapter) {
      issues.push(`Tension budget ${expectedChapter} must exist.`);
      continue;
    }

    if (isBlank(budget.requiredTurn)) {
      issues.push(`Tension budget ${expectedChapter} must include requiredTurn.`);
    }
    if (isBlank(budget.forcedChoice)) {
      issues.push(`Tension budget ${expectedChapter} must include forcedChoice.`);
    }
    if (isBlank(budget.costToPay)) {
      issues.push(`Tension budget ${expectedChapter} must include costToPay.`);
    }
    if (isBlank(budget.irreversibleChange)) {
      issues.push(
        `Tension budget ${expectedChapter} must include irreversibleChange.`
      );
    }
    if (isBlank(budget.readerQuestion)) {
      issues.push(`Tension budget ${expectedChapter} must include readerQuestion.`);
    }
    if (isBlank(budget.hookPressure)) {
      issues.push(`Tension budget ${expectedChapter} must include hookPressure.`);
    }
    if (!Array.isArray(budget.flatnessRisks) || budget.flatnessRisks.length === 0) {
      issues.push(
        `Tension budget ${expectedChapter} must include at least one flatnessRisk.`
      );
    }
    if (!tensionPressureLevels.has(budget.pressureLevel)) {
      issues.push(
        `Tension budget ${expectedChapter} has invalid pressureLevel ${budget.pressureLevel}.`
      );
    }
    if (!dominantTensions.has(budget.dominantTension)) {
      issues.push(
        `Tension budget ${expectedChapter} has invalid dominantTension ${budget.dominantTension}.`
      );
    }

    if (budget.dominantTension === previousDominantTension) {
      repeatedTensionCount += 1;
    } else {
      previousDominantTension = budget.dominantTension;
      repeatedTensionCount = 1;
    }
    if (repeatedTensionCount > 3) {
      issues.push(
        `Tension budgets must not repeat dominantTension ${budget.dominantTension} for more than 3 consecutive chapters.`
      );
    }
  }

  for (let index = 0; index <= sorted.length - 3; index += 1) {
    const window = sorted.slice(index, index + 3);
    if (
      window.length === 3 &&
      window.every((budget) => budget.pressureLevel === 'low')
    ) {
      issues.push(
        'Tension budgets must include medium or higher pressure within every 3 chapters.'
      );
      break;
    }
  }

  return result([...new Set(issues)]);
}
