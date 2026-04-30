import type { NarrativeAudit } from './types.js';

export { parseJsonObject } from './json.js';

export function buildNarrativeBiblePrompt(input: {
  idea: string;
  targetChapters: number;
  wordsPerChapter: number;
}) {
  return [
    'Design a long-form Chinese web novel narrative bible.',
    'Return valid JSON only. Do not wrap JSON in markdown fences.',
    `User idea: ${input.idea}`,
    `Target chapters: ${input.targetChapters}`,
    `Words per chapter: ${input.wordsPerChapter}`,
    'The JSON must include premise, genreContract, targetReaderExperience, themeQuestion, themeAnswerDirection, centralDramaticQuestion, endingState, voiceGuide.',
    'Each characterArcs item must include id, name, roleType, desire, fear, flaw, misbelief, wound, externalGoal, internalNeed, arcDirection, decisionLogic, lineWillNotCross, lineMayEventuallyCross, currentArcPhase.',
    'Each worldRules item must include id, category, ruleText, cost, whoBenefits, whoSuffers, taboo, violationConsequence, allowedException, currentStatus.',
    'Each narrativeThreads item must include id, type, promise, plantedAt, expectedPayoff, resolvedAt, currentState, importance, payoffMustChange, ownerCharacterId, relatedRelationshipId, notes.',
    'All ids must be stable kebab-case strings.',
  ].join('\n');
}

export function buildVolumePlanPrompt(input: {
  targetChapters: number;
  bibleSummary: string;
}) {
  return [
    'Create volume plans for this long-form Chinese web novel.',
    'Return valid JSON only: an array of volume plan objects.',
    `Target chapters: ${input.targetChapters}`,
    `Narrative bible summary:\n${input.bibleSummary}`,
    'Chapter ranges must continuously cover chapter 1 through targetChapters.',
    'Each volume must include title, chapterStart, chapterEnd, roleInStory, mainPressure, promisedPayoff, characterArcMovement, relationshipMovement, worldExpansion, endingTurn.',
  ].join('\n');
}

export function buildChapterCardPrompt(input: {
  bookId: string;
  targetChapters: number;
  bibleSummary: string;
  volumePlansText: string;
}) {
  return [
    'Create chapter cards for a long-form Chinese web novel.',
    'Return valid JSON only with keys cards, threadActions, characterPressures, relationshipActions.',
    `Book id: ${input.bookId}`,
    `Target chapters: ${input.targetChapters}`,
    `Narrative bible summary:\n${input.bibleSummary}`,
    `Volume plans:\n${input.volumePlansText}`,
    'Each card must include volumeIndex, chapterIndex, title, plotFunction, povCharacterId, externalConflict, internalConflict, relationshipChange, worldRuleUsedOrTested, informationReveal, readerReward, endingHook, mustChange, forbiddenMoves.',
    'Every chapter must produce an irreversible mustChange.',
    'threadActions must use action plant, advance, misdirect, or payoff.',
    'Do not create extra major characters unless required by the bible.',
  ].join('\n');
}

export function buildNarrativeDraftPrompt(input: {
  idea: string;
  wordsPerChapter: number;
  commandContext: string;
}) {
  return [
    'Write the next chapter of a long-form Chinese web novel.',
    `Book idea: ${input.idea}`,
    `Write approximately ${input.wordsPerChapter} Chinese characters.`,
    input.commandContext,
    'Hard requirements: complete mustChange, preserve forbiddenMoves, show world-rule cost when a rule is used, and make relationship changes visible through action.',
    'Return only the final chapter prose. Do not summarize or explain.',
  ].join('\n');
}

export function buildChapterAuditPrompt(input: {
  draft: string;
  auditContext: string;
}) {
  return [
    'Audit this chapter draft for long-form narrative drift.',
    'Return valid JSON only with passed, score, decision, issues, scoring, stateUpdates.',
    'Issue type enum: character_logic, relationship_static, world_rule_violation, mainline_stall, thread_leak, pacing_problem, theme_drift, chapter_too_empty, forbidden_move, missing_reader_reward.',
    'Decision rules: accept for strong chapters, revise for fixable major issues, rewrite for blockers.',
    `Audit context:\n${input.auditContext}`,
    `Draft:\n${input.draft}`,
  ].join('\n');
}

export function buildRevisionPrompt(input: {
  originalPrompt: string;
  draft: string;
  issues: NarrativeAudit['issues'];
}) {
  return [
    input.originalPrompt,
    '',
    'Revise the draft using the audit issues below.',
    'Preserve the chapter direction and useful prose. Do not introduce new major characters or new major rules.',
    `Draft:\n${input.draft}`,
    'Audit issues:',
    ...input.issues.map(
      (issue) =>
        `- ${issue.severity} ${issue.type}: ${issue.evidence}; fix=${issue.fixInstruction}`
    ),
    'Return only the revised chapter prose.',
  ].join('\n');
}
