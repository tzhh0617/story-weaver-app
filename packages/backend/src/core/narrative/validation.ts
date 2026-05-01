import type {
  ChapterCard,
  ChapterTensionBudget,
  NarrativeBible,
  ValidationResult,
  VolumePlan,
} from './types.js';
import { validateViralStoryProtocol } from './viral-story-protocol.js';

const characterRoleTypes = new Set([
  'protagonist',
  'deuteragonist',
  'supporting',
  'antagonist',
  'minor',
]);
const arcDirections = new Set(['growth', 'fall', 'corruption', 'recovery', 'flat']);
const worldRuleCategories = new Set([
  'power',
  'society',
  'resource',
  'taboo',
  'law',
  'daily_life',
  'history',
]);
const narrativeThreadTypes = new Set([
  'main',
  'subplot',
  'relationship',
  'mystery',
  'theme',
  'antagonist',
  'world',
]);
const narrativeThreadStates = new Set([
  'open',
  'advanced',
  'twisted',
  'paid_off',
  'abandoned',
]);
const threadImportanceValues = new Set(['critical', 'normal', 'minor']);
const payoffChangeTargets = new Set([
  'plot',
  'relationship',
  'world',
  'character',
  'theme',
]);
const readerRewards = new Set([
  'reversal',
  'breakthrough',
  'failure',
  'truth',
  'upgrade',
  'confession',
  'dread',
  'relief',
]);
const tensionPressureLevels = new Set(['low', 'medium', 'high', 'peak']);
const dominantTensions = new Set([
  'danger',
  'desire',
  'relationship',
  'mystery',
  'moral_choice',
  'deadline',
  'status_loss',
  'resource_cost',
]);

function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

function result(issues: string[]): ValidationResult {
  return {
    valid: issues.length === 0,
    issues,
  };
}

function collectDuplicateIds(
  items: Array<{ id: string }>,
  label: string
): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (isBlank(item.id)) {
      issues.push(`${label} id must not be blank.`);
      continue;
    }
    if (seen.has(item.id)) {
      issues.push(`${label} id ${item.id} must not be duplicated.`);
    }
    seen.add(item.id);
  }

  return issues;
}

export function validateNarrativeBible(
  bible: NarrativeBible,
  input: { targetChapters: number }
): ValidationResult {
  const issues: string[] = [];
  const characterArcs = Array.isArray(bible.characterArcs)
    ? bible.characterArcs
    : [];
  const relationshipEdges = Array.isArray(bible.relationshipEdges)
    ? bible.relationshipEdges
    : [];
  const worldRules = Array.isArray(bible.worldRules) ? bible.worldRules : [];
  const narrativeThreads = Array.isArray(bible.narrativeThreads)
    ? bible.narrativeThreads
    : [];

  if (!Array.isArray(bible.characterArcs)) {
    issues.push('Narrative bible must include characterArcs array.');
  }
  if (!Array.isArray(bible.relationshipEdges)) {
    issues.push('Narrative bible must include relationshipEdges array.');
  }
  if (!Array.isArray(bible.worldRules)) {
    issues.push('Narrative bible must include worldRules array.');
  }
  if (!Array.isArray(bible.narrativeThreads)) {
    issues.push('Narrative bible must include narrativeThreads array.');
  }

  const characterIds = new Set(characterArcs.map((character) => character.id));
  const relationshipIds = new Set(
    relationshipEdges.map((relationship) => relationship.id)
  );

  issues.push(...collectDuplicateIds(characterArcs, 'Character'));
  issues.push(...collectDuplicateIds(relationshipEdges, 'Relationship'));
  issues.push(...collectDuplicateIds(worldRules, 'World rule'));
  issues.push(...collectDuplicateIds(narrativeThreads, 'Thread'));

  if (!characterArcs.some((character) => character.roleType === 'protagonist')) {
    issues.push('Narrative bible must include a protagonist.');
  }
  if (isBlank(bible.themeQuestion)) issues.push('Narrative bible must include themeQuestion.');
  if (isBlank(bible.themeAnswerDirection)) {
    issues.push('Narrative bible must include themeAnswerDirection.');
  }

  for (const character of characterArcs) {
    if (isBlank(character.name)) issues.push(`Character ${character.id} must include name.`);
    if (isBlank(character.desire)) issues.push(`Character ${character.id} must include desire.`);
    if (isBlank(character.fear)) issues.push(`Character ${character.id} must include fear.`);
    if (isBlank(character.flaw)) issues.push(`Character ${character.id} must include flaw.`);
    if (isBlank(character.externalGoal)) {
      issues.push(`Character ${character.id} must include externalGoal.`);
    }
    if (isBlank(character.internalNeed)) {
      issues.push(`Character ${character.id} must include internalNeed.`);
    }
    if (isBlank(character.decisionLogic)) {
      issues.push(`Character ${character.id} must include decisionLogic.`);
    }
    if (isBlank(character.currentArcPhase)) {
      issues.push(`Character ${character.id} must include currentArcPhase.`);
    }
    if (!characterRoleTypes.has(character.roleType)) {
      issues.push(
        `Character ${character.id} has invalid roleType ${character.roleType}.`
      );
    }
    if (!arcDirections.has(character.arcDirection)) {
      issues.push(
        `Character ${character.id} has invalid arcDirection ${character.arcDirection}.`
      );
    }
  }

  for (const relationship of relationshipEdges) {
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
    if (isBlank(relationship.visibleLabel)) {
      issues.push(`Relationship ${relationship.id} must include visibleLabel.`);
    }
    if (!Number.isFinite(relationship.trustLevel)) {
      issues.push(
        `Relationship ${relationship.id} must include numeric trustLevel.`
      );
    }
    if (!Number.isFinite(relationship.tensionLevel)) {
      issues.push(
        `Relationship ${relationship.id} must include numeric tensionLevel.`
      );
    }
    if (isBlank(relationship.currentState)) {
      issues.push(`Relationship ${relationship.id} must include currentState.`);
    }
    if (
      !Array.isArray(relationship.plannedTurns) ||
      relationship.plannedTurns.length === 0
    ) {
      issues.push(
        `Relationship ${relationship.id} must include at least one plannedTurn.`
      );
    }
  }

  for (const rule of worldRules) {
    if (isBlank(rule.ruleText)) {
      issues.push(`World rule ${rule.id} must include ruleText.`);
    }
    if (isBlank(rule.cost)) issues.push(`World rule ${rule.id} must include cost.`);
    if (isBlank(rule.currentStatus)) {
      issues.push(`World rule ${rule.id} must include currentStatus.`);
    }
    if (!worldRuleCategories.has(rule.category)) {
      issues.push(`World rule ${rule.id} has invalid category ${rule.category}.`);
    }
  }

  if (!narrativeThreads.some((thread) => thread.type === 'main')) {
    issues.push('Narrative bible must include a main thread.');
  }

  for (const thread of narrativeThreads) {
    if (isBlank(thread.promise)) {
      issues.push(`Thread ${thread.id} must include promise.`);
    }
    if (thread.expectedPayoff !== null && thread.expectedPayoff > input.targetChapters) {
      issues.push(`Thread ${thread.id} expectedPayoff exceeds target chapters.`);
    }
    if (isBlank(thread.currentState)) {
      issues.push(`Thread ${thread.id} must include currentState.`);
    }
    if (isBlank(thread.importance)) {
      issues.push(`Thread ${thread.id} must include importance.`);
    }
    if (isBlank(thread.payoffMustChange)) {
      issues.push(`Thread ${thread.id} must include payoffMustChange.`);
    }
    if (!narrativeThreadTypes.has(thread.type)) {
      issues.push(`Thread ${thread.id} has invalid type ${thread.type}.`);
    }
    if (!narrativeThreadStates.has(thread.currentState)) {
      issues.push(
        `Thread ${thread.id} has invalid currentState ${thread.currentState}.`
      );
    }
    if (!threadImportanceValues.has(thread.importance)) {
      issues.push(
        `Thread ${thread.id} has invalid importance ${thread.importance}.`
      );
    }
    if (!payoffChangeTargets.has(thread.payoffMustChange)) {
      issues.push(
        `Thread ${thread.id} has invalid payoffMustChange ${thread.payoffMustChange}.`
      );
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
  const seenVolumeIndexes = new Set<number>();

  for (const volume of [...volumePlans].sort((left, right) => left.volumeIndex - right.volumeIndex)) {
    if (!Number.isInteger(volume.volumeIndex) || volume.volumeIndex <= 0) {
      issues.push(`Volume ${volume.volumeIndex} must use a positive volumeIndex.`);
    } else if (seenVolumeIndexes.has(volume.volumeIndex)) {
      issues.push(`Volume ${volume.volumeIndex} must not be duplicated.`);
    }
    seenVolumeIndexes.add(volume.volumeIndex);

    if (volume.chapterStart !== expectedStart) {
      issues.push(`Volume ${volume.volumeIndex} must start at chapter ${expectedStart}.`);
    }
    if (volume.chapterEnd < volume.chapterStart) {
      issues.push(
        `Volume ${volume.volumeIndex} chapterEnd must be greater than or equal to chapterStart.`
      );
    }
    if (isBlank(volume.title)) {
      issues.push(`Volume ${volume.volumeIndex} must include title.`);
    }
    if (isBlank(volume.roleInStory)) {
      issues.push(`Volume ${volume.volumeIndex} must include roleInStory.`);
    }
    if (isBlank(volume.mainPressure)) {
      issues.push(`Volume ${volume.volumeIndex} must include mainPressure.`);
    }
    if (isBlank(volume.promisedPayoff)) {
      issues.push(`Volume ${volume.volumeIndex} must include promisedPayoff.`);
    }
    if (isBlank(volume.characterArcMovement)) {
      issues.push(
        `Volume ${volume.volumeIndex} must include characterArcMovement.`
      );
    }
    if (isBlank(volume.relationshipMovement)) {
      issues.push(
        `Volume ${volume.volumeIndex} must include relationshipMovement.`
      );
    }
    if (isBlank(volume.worldExpansion)) {
      issues.push(`Volume ${volume.volumeIndex} must include worldExpansion.`);
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
