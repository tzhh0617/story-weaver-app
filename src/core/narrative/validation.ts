import type {
  ChapterCard,
  ChapterTensionBudget,
  NarrativeBible,
  ValidationResult,
  VolumePlan,
} from './types.js';
import { validateViralStoryProtocol } from './viral-story-protocol.js';

function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

function result(issues: string[]): ValidationResult {
  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateNarrativeBible(
  bible: NarrativeBible,
  input: { targetChapters: number }
): ValidationResult {
  const issues: string[] = [];
  const characterIds = new Set(bible.characterArcs.map((character) => character.id));
  const relationshipIds = new Set(
    bible.relationshipEdges.map((relationship) => relationship.id)
  );

  if (!bible.characterArcs.some((character) => character.roleType === 'protagonist')) {
    issues.push('Narrative bible must include a protagonist.');
  }
  if (isBlank(bible.themeQuestion)) issues.push('Narrative bible must include themeQuestion.');
  if (isBlank(bible.themeAnswerDirection)) {
    issues.push('Narrative bible must include themeAnswerDirection.');
  }

  for (const character of bible.characterArcs) {
    if (isBlank(character.desire)) issues.push(`Character ${character.id} must include desire.`);
    if (isBlank(character.fear)) issues.push(`Character ${character.id} must include fear.`);
    if (isBlank(character.flaw)) issues.push(`Character ${character.id} must include flaw.`);
    if (isBlank(character.decisionLogic)) {
      issues.push(`Character ${character.id} must include decisionLogic.`);
    }
  }

  for (const relationship of bible.relationshipEdges) {
    if (!characterIds.has(relationship.fromCharacterId)) {
      issues.push(
        `Relationship ${relationship.id} references missing fromCharacterId ${relationship.fromCharacterId}.`
      );
    }
    if (!characterIds.has(relationship.toCharacterId)) {
      issues.push(
        `Relationship ${relationship.id} references missing toCharacterId ${relationship.toCharacterId}.`
      );
    }
  }

  for (const rule of bible.worldRules) {
    if (isBlank(rule.cost)) issues.push(`World rule ${rule.id} must include cost.`);
  }

  if (!bible.narrativeThreads.some((thread) => thread.type === 'main')) {
    issues.push('Narrative bible must include a main thread.');
  }

  for (const thread of bible.narrativeThreads) {
    if (thread.expectedPayoff !== null && thread.expectedPayoff > input.targetChapters) {
      issues.push(`Thread ${thread.id} expectedPayoff exceeds target chapters.`);
    }
    if (thread.ownerCharacterId && !characterIds.has(thread.ownerCharacterId)) {
      issues.push(
        `Thread ${thread.id} references missing ownerCharacterId ${thread.ownerCharacterId}.`
      );
    }
    if (thread.relatedRelationshipId && !relationshipIds.has(thread.relatedRelationshipId)) {
      issues.push(
        `Thread ${thread.id} references missing relatedRelationshipId ${thread.relatedRelationshipId}.`
      );
    }
  }

  if (bible.viralStoryProtocol) {
    issues.push(...validateViralStoryProtocol(bible.viralStoryProtocol).issues);
  }

  return result(issues);
}

export function validateVolumePlans(
  volumePlans: VolumePlan[],
  input: { targetChapters: number }
): ValidationResult {
  const issues: string[] = [];
  let expectedStart = 1;

  for (const volume of [...volumePlans].sort((left, right) => left.volumeIndex - right.volumeIndex)) {
    if (volume.chapterStart !== expectedStart) {
      issues.push(`Volume ${volume.volumeIndex} must start at chapter ${expectedStart}.`);
    }
    if (volume.chapterEnd < volume.chapterStart) {
      issues.push(
        `Volume ${volume.volumeIndex} chapterEnd must be greater than or equal to chapterStart.`
      );
    }
    if (isBlank(volume.promisedPayoff)) {
      issues.push(`Volume ${volume.volumeIndex} must include promisedPayoff.`);
    }
    if (isBlank(volume.endingTurn)) {
      issues.push(`Volume ${volume.volumeIndex} must include endingTurn.`);
    }
    expectedStart = volume.chapterEnd + 1;
  }

  if (expectedStart !== input.targetChapters + 1) {
    issues.push(`Volume plans must end at chapter ${input.targetChapters}.`);
  }

  return result(issues);
}

export function validateChapterCards(
  cards: ChapterCard[],
  input: { targetChapters: number }
): ValidationResult {
  const issues: string[] = [];
  const sorted = [...cards].sort((left, right) => left.chapterIndex - right.chapterIndex);

  for (let index = 0; index < input.targetChapters; index += 1) {
    const expectedChapter = index + 1;
    const card = sorted[index];
    if (!card || card.chapterIndex !== expectedChapter) {
      issues.push(`Chapter card ${expectedChapter} must exist.`);
      continue;
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
    if (isBlank(card.mustChange)) {
      issues.push(`Chapter ${expectedChapter} must include mustChange.`);
    }
    if (isBlank(card.endingHook)) {
      issues.push(`Chapter ${expectedChapter} must include endingHook.`);
    }
  }

  return result(issues);
}

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
    if (isBlank(budget.costToPay)) {
      issues.push(`Tension budget ${expectedChapter} must include costToPay.`);
    }
    if (isBlank(budget.irreversibleChange)) {
      issues.push(
        `Tension budget ${expectedChapter} must include irreversibleChange.`
      );
    }
    if (isBlank(budget.hookPressure)) {
      issues.push(`Tension budget ${expectedChapter} must include hookPressure.`);
    }
    if (!Array.isArray(budget.flatnessRisks) || budget.flatnessRisks.length === 0) {
      issues.push(
        `Tension budget ${expectedChapter} must include at least one flatnessRisk.`
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
