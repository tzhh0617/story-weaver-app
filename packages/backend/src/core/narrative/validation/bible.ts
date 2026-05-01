import type { NarrativeBible, ValidationResult } from '../types.js';
import { validateViralStoryProtocol } from '../viral-story-protocol.js';
import {
  arcDirections,
  characterRoleTypes,
  collectDuplicateIds,
  isBlank,
  narrativeThreadStates,
  narrativeThreadTypes,
  payoffChangeTargets,
  result,
  threadImportanceValues,
  worldRuleCategories,
} from './shared.js';

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
