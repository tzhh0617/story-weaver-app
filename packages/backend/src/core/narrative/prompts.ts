import type { NarrativeAudit, ViralStoryProtocol } from './types.js';
import { buildOpeningRetentionProtocolLines } from './opening-retention.js';
import {
  buildAiFirstTextPolicyLines,
  buildJsonOutputPolicyLines,
} from './text-policy.js';
import { formatViralProtocolForPrompt } from './viral-story-protocol.js';

export { parseJsonObject } from './json.js';

function viralPromptBlock(
  protocol: ViralStoryProtocol | null | undefined,
  chapterIndex?: number | null
) {
  return protocol
    ? [formatViralProtocolForPrompt(protocol, { chapterIndex })]
    : [];
}

export function buildNarrativeBiblePrompt(input: {
  idea: string;
  targetChapters: number;
  wordsPerChapter: number;
}) {
  return [
    'Design a long-form Chinese web novel narrative bible.',
    ...buildJsonOutputPolicyLines(),
    `User idea: ${input.idea}`,
    `Target chapters: ${input.targetChapters}`,
    `Words per chapter: ${input.wordsPerChapter}`,
    'The JSON must include premise, genreContract, targetReaderExperience, themeQuestion, themeAnswerDirection, centralDramaticQuestion, endingState, voiceGuide.',
    'The JSON must include characterArcs array, relationshipEdges array, worldRules array, and narrativeThreads array. Use [] only when genuinely empty.',
    'Each characterArcs item must include id, name, roleType, desire, fear, flaw, misbelief, wound, externalGoal, internalNeed, arcDirection, decisionLogic, lineWillNotCross, lineMayEventuallyCross, currentArcPhase.',
    'Each relationshipEdges item must include id, fromCharacterId, toCharacterId, visibleLabel, hiddenTruth, dependency, debt, misunderstanding, affection, harmPattern, sharedGoal, valueConflict, trustLevel, tensionLevel, currentState, plannedTurns.',
    'Each worldRules item must include id, category, ruleText, cost, whoBenefits, whoSuffers, taboo, violationConsequence, allowedException, currentStatus.',
    'Each narrativeThreads item must include id, type, promise, plantedAt, expectedPayoff, resolvedAt, currentState, importance, payoffMustChange, ownerCharacterId, relatedRelationshipId, notes.',
    'The JSON may include viralStoryProtocol with readerPromise, targetEmotion, coreDesire, protagonistDrive, hookEngine, payoffCadence, tropeContract, antiClicheRules, longTermQuestion.',
    'If viralStoryProtocol is included, it must describe reader retention mechanics, not market claims.',
    'All ids must be stable kebab-case strings.',
  ].join('\n');
}

export function buildVolumePlanPrompt(input: {
  targetChapters: number;
  bibleSummary: string;
  viralStoryProtocol?: ViralStoryProtocol | null;
}) {
  return [
    'Create volume plans for this long-form Chinese web novel.',
    ...buildJsonOutputPolicyLines(),
    'Return an array of volume plan objects.',
    `Target chapters: ${input.targetChapters}`,
    `Narrative bible summary:\n${input.bibleSummary}`,
    ...viralPromptBlock(input.viralStoryProtocol),
    'Chapter ranges must continuously cover chapter 1 through targetChapters.',
    'Each volume must include volumeIndex, title, chapterStart, chapterEnd, roleInStory, mainPressure, promisedPayoff, characterArcMovement, relationshipMovement, worldExpansion, endingTurn.',
    'Each volume must include a stage payoff that serves the reader promise when viral protocol is available.',
    'Each volume ending must upgrade the long-term reader question.',
  ].join('\n');
}

export function buildChapterCardPrompt(input: {
  bookId: string;
  targetChapters: number;
  bibleSummary: string;
  volumePlansText: string;
  viralStoryProtocol?: ViralStoryProtocol | null;
}) {
  return [
    'Create chapter cards for a long-form Chinese web novel.',
    ...buildJsonOutputPolicyLines(),
    'Return an object with keys cards, threadActions, characterPressures, relationshipActions.',
    `Book id: ${input.bookId}`,
    `Target chapters: ${input.targetChapters}`,
    `Narrative bible summary:\n${input.bibleSummary}`,
    `Volume plans:\n${input.volumePlansText}`,
    'Each card must include volumeIndex, chapterIndex, title, plotFunction, povCharacterId, externalConflict, internalConflict, relationshipChange, worldRuleUsedOrTested, informationReveal, readerReward, endingHook, mustChange, forbiddenMoves.',
    'Every chapter must produce an irreversible mustChange.',
    'threadActions must use action plant, advance, misdirect, or payoff.',
    'threadActions items must include volumeIndex, chapterIndex, threadId, action, requiredEffect.',
    'characterPressures items must include volumeIndex, chapterIndex, characterId, desirePressure, fearPressure, flawTrigger, expectedChoice.',
    'relationshipActions items must include volumeIndex, chapterIndex, relationshipId, action, requiredChange.',
    'Do not create extra major characters unless required by the bible.',
    ...viralPromptBlock(input.viralStoryProtocol),
    'When viral protocol is available, each chapter must serve readerPromise and advance or complicate longTermQuestion.',
    'Use payoffCadence to decide whether the chapter needs a minor payoff or major payoff.',
    'When a payoff appears, the card must make the side effect visible through mustChange, endingHook, or forbiddenMoves.',
    'If the chapter uses a familiar trope, state the fresh variation inside plotFunction or informationReveal.',
    ...buildOpeningRetentionProtocolLines({
      targetChapters: input.targetChapters,
    }),
  ].join('\n');
}

export function buildTensionBudgetPrompt(input: {
  bookId: string;
  targetChapters: number;
  bibleSummary: string;
  volumePlansText: string;
  chapterCardsText: string;
  viralStoryProtocol?: ViralStoryProtocol | null;
}) {
  return [
    'Create tension budgets for a long-form Chinese web novel.',
    ...buildJsonOutputPolicyLines(),
    'Return an array of chapter tension budget objects.',
    `Book id: ${input.bookId}`,
    `Target chapters: ${input.targetChapters}`,
    `Narrative bible summary:\n${input.bibleSummary}`,
    `Volume plans:\n${input.volumePlansText}`,
    `Chapter cards:\n${input.chapterCardsText}`,
    'Each chapter must include volumeIndex, chapterIndex, pressureLevel, dominantTension, requiredTurn, forcedChoice, costToPay, irreversibleChange, readerQuestion, hookPressure, flatnessRisks.',
    'pressureLevel must be low, medium, high, or peak.',
    'dominantTension must be danger, desire, relationship, mystery, moral_choice, deadline, status_loss, or resource_cost.',
    'Do not assign the same dominantTension to more than three consecutive chapters.',
    'Low pressure chapters must still include visible internal, relational, informational, or thematic movement.',
    'Peak chapters should align with volume turns, major payoffs, betrayals, failures, or irreversible decisions.',
    ...viralPromptBlock(input.viralStoryProtocol),
    'When viral protocol is available, dominantTension must support the expected payoff or pressure setup.',
    'costToPay must connect to this chapter payoff, breakthrough, or hook engine.',
    'readerQuestion must create specific next-chapter action pressure.',
    ...buildOpeningRetentionProtocolLines({
      targetChapters: input.targetChapters,
    }),
  ].join('\n');
}

export function buildNarrativeDraftPrompt(input: {
  idea: string;
  wordsPerChapter: number;
  commandContext: string;
  routePlanText?: string | null;
  viralStoryProtocol?: ViralStoryProtocol | null;
  chapterIndex?: number | null;
}) {
  return [
    'Write the next chapter of a long-form Chinese web novel.',
    `Book idea: ${input.idea}`,
    `Write approximately ${input.wordsPerChapter} Chinese characters.`,
    ...buildAiFirstTextPolicyLines(),
    input.routePlanText ? `Story route requirements:\n${input.routePlanText}` : '',
    ...viralPromptBlock(input.viralStoryProtocol, input.chapterIndex),
    input.commandContext,
    'Hard requirements: complete mustChange, fulfill the Tension Budget when provided, make forcedChoice visible through action, make costToPay visible before the chapter ends, preserve forbiddenMoves, show world-rule cost when a rule is used, and make relationship changes visible through action.',
    'Return only the final chapter prose. Do not include any chapter title, heading, Markdown title, or title line in the body text. Do not summarize or explain.',
  ].join('\n');
}

export function buildChapterAuditPrompt(input: {
  draft: string;
  auditContext: string;
  routePlanText?: string | null;
  viralStoryProtocol?: ViralStoryProtocol | null;
  chapterIndex?: number | null;
}) {
  return [
    'Audit this chapter draft for long-form narrative drift.',
    ...buildJsonOutputPolicyLines(),
    'Return an object with passed, score, decision, issues, scoring, stateUpdates.',
    'When viral protocol is provided, scoring must include scoring.viral: openingHook, desireClarity, payoffStrength, readerQuestionStrength, tropeFulfillment, antiClicheFreshness.',
    'Issue type enum: character_logic, relationship_static, world_rule_violation, mainline_stall, thread_leak, pacing_problem, theme_drift, chapter_too_empty, forbidden_move, missing_reader_reward, flat_chapter, weak_choice_pressure, missing_consequence, soft_hook, repeated_tension_pattern, weak_reader_promise, unclear_desire, missing_payoff, payoff_without_cost, generic_trope, weak_reader_question, stale_hook_engine.',
    'Also audit flatness with scoring.flatness: conflictEscalation, choicePressure, consequenceVisibility, irreversibleChange, hookStrength.',
    'Flatness questions: Did the chapter escalate, turn, or meaningfully redirect conflict? Did the POV character face a visible choice? Was a cost paid or consequence made visible? Did the ending create forward pressure? Did the chapter repeat the same tension pattern without new effect?',
    'Decision rules: accept for strong chapters, revise for fixable major issues, rewrite for blockers.',
    ...viralPromptBlock(input.viralStoryProtocol, input.chapterIndex),
    input.routePlanText ? `Story route requirements:\n${input.routePlanText}` : '',
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
    ...buildAiFirstTextPolicyLines(),
    'Preserve the chapter direction and useful prose. Do not introduce new major characters or new major rules.',
    'If an issue is viral-specific, preserve the chapter direction and fix the reader-promise, payoff, cost, hook, or anti-cliche failure locally.',
    `Draft:\n${input.draft}`,
    'Audit issues:',
    ...input.issues.map(
      (issue) =>
        `- ${issue.severity} ${issue.type}: ${issue.evidence}; fix=${issue.fixInstruction}`
    ),
    'Return only the revised chapter prose.',
  ].join('\n');
}
