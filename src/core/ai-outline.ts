import {
  buildTitlePrompt,
  buildChapterOutlinePrompt,
  buildMasterOutlinePrompt,
  buildVolumeOutlinePrompt,
  buildWorldPrompt,
} from './prompt-builder.js';
import {
  buildChapterCardPrompt,
  buildNarrativeBiblePrompt,
  buildTensionBudgetPrompt,
  buildVolumePlanPrompt,
} from './narrative/prompts.js';
import { parseJsonObject } from './narrative/json.js';
import { deriveViralStoryProtocol } from './narrative/viral-story-protocol.js';
import {
  validateChapterCards,
  validateNarrativeBible,
  validateTensionBudgets,
  validateVolumePlans,
} from './narrative/validation.js';
import type {
  ArcDirection,
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
  CharacterRoleType,
  NarrativeBible,
  NarrativeThreadState,
  NarrativeThreadType,
  PayoffChangeTarget,
  ReaderReward,
  RelationshipAction,
  ThreadImportance,
  ThreadAction,
  ViralPayoffType,
  ViralStoryProtocol,
  ViralTargetEmotion,
  ViralTropeContract,
  VolumePlan,
  WorldRuleCategory,
} from './narrative/types.js';
import type {
  ChapterOutline,
  OutlineBundle,
  OutlineGenerationInput,
} from './types.js';
import {
  normalizeChapterOutlinesToTarget,
  renumberChapterOutlinesFrom,
  takeChapterOutlinesWithinTarget,
} from './story-constraints.js';

function parseChapterOutlineLines(
  text: string,
  volumeIndex: number
): ChapterOutline[] {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [chapterIndex, title, outline] = line.split('|');

      return {
        volumeIndex,
        chapterIndex: Number(chapterIndex),
        title: title ?? '',
        outline: outline ?? '',
      };
    });
}

function normalizeGeneratedTitle(text: string) {
  return text
    .trim()
    .split('\n')[0]
    .replace(/^["'“”‘’《]+|["'“”‘’》]+$/g, '')
    .trim();
}

function normalizePlainContextText(text: string) {
  return text
    .trim()
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s+/, '')
        .replace(/^[-*]\s+/, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
    )
    .filter(Boolean)
    .join('\n');
}

function firstNonEmptyString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

function toPlainText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => toPlainText(item))
      .filter(Boolean)
      .join(' / ')
      .trim();
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => toPlainText(item))
      .filter(Boolean)
      .join(' / ')
      .trim();
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function normalizeRoleType(value: unknown): CharacterRoleType {
  switch (value) {
    case 'protagonist':
    case 'deuteragonist':
    case 'supporting':
    case 'antagonist':
    case 'minor':
      return value;
    default:
      return 'supporting';
  }
}

function normalizeArcDirection(value: unknown): ArcDirection {
  switch (value) {
    case 'growth':
    case 'fall':
    case 'corruption':
    case 'recovery':
    case 'flat':
      return value;
    default:
      return 'growth';
  }
}

function normalizeWorldRuleCategory(value: unknown): WorldRuleCategory {
  switch (value) {
    case 'power':
    case 'society':
    case 'resource':
    case 'taboo':
    case 'law':
    case 'daily_life':
    case 'history':
      return value;
    case 'power-system':
      return 'power';
    default:
      return 'power';
  }
}

function normalizeThreadType(value: unknown): NarrativeThreadType {
  switch (value) {
    case 'main':
    case 'subplot':
    case 'relationship':
    case 'mystery':
    case 'theme':
    case 'antagonist':
    case 'world':
      return value;
    default:
      return 'subplot';
  }
}

function normalizeThreadState(value: unknown): NarrativeThreadState {
  switch (value) {
    case 'open':
    case 'advanced':
    case 'twisted':
    case 'paid_off':
    case 'abandoned':
      return value;
    case 'active':
      return 'open';
    case 'resolved':
      return 'paid_off';
    default:
      return 'open';
  }
}

function normalizeThreadImportance(value: unknown): ThreadImportance {
  switch (value) {
    case 'critical':
    case 'normal':
    case 'minor':
      return value;
    case 'core':
      return 'critical';
    default:
      return 'normal';
  }
}

function normalizeTargetEmotion(value: unknown): ViralTargetEmotion {
  switch (value) {
    case 'comeback':
    case 'revenge':
    case 'survival':
    case 'wonder':
    case 'romantic_tension':
    case 'power_climb':
    case 'mystery_breakthrough':
    case 'being_chosen':
    case 'moral_pressure':
      return value;
    default:
      return 'comeback';
  }
}

function normalizeTropeContract(
  values: unknown
): ViralTropeContract[] {
  const normalized = (Array.isArray(values) ? values : [values]).flatMap((value) =>
    toPlainText(value)
      .split(/[,/]/u)
      .map((item) => item.trim())
      .filter(Boolean)
  );

  const valid = normalized.filter(
    (value): value is ViralTropeContract =>
      [
        'rebirth_change_fate',
        'system_growth',
        'hidden_identity',
        'revenge_payback',
        'weak_to_strong',
        'forbidden_bond',
        'case_breaking',
        'sect_or_family_pressure',
        'survival_game',
        'business_or_power_game',
      ].includes(value)
  );

  return valid.length > 0 ? [...new Set(valid)] : ['weak_to_strong'];
}

function normalizePayoffTypes(values: unknown): ViralPayoffType[] {
  const normalized = (Array.isArray(values) ? values : [values]).flatMap((value) =>
    toPlainText(value)
      .split(/[,/]/u)
      .map((item) => item.trim())
      .filter(Boolean)
  );

  const valid = normalized.filter(
    (value): value is ViralPayoffType =>
      [
        'face_slap',
        'upgrade',
        'truth_reveal',
        'relationship_shift',
        'resource_gain',
        'local_victory',
        'identity_reveal',
        'enemy_setback',
      ].includes(value)
  );

  return valid.length > 0 ? [...new Set(valid)] : ['local_victory'];
}

function normalizeViralStoryProtocolShape(
  protocol: ViralStoryProtocol | undefined
): ViralStoryProtocol | undefined {
  if (!protocol) {
    return undefined;
  }

  const minorPayoffEveryChapters =
    normalizeChapterNumber(protocol.payoffCadence?.minorPayoffEveryChapters) ?? 2;
  const majorPayoffEveryChapters =
    normalizeChapterNumber(protocol.payoffCadence?.majorPayoffEveryChapters) ?? 8;
  const mode = [
    'fast',
    'steady',
    'slow_burn',
    'suppressed_then_burst',
  ].includes(toPlainText(protocol.payoffCadence?.mode))
    ? (toPlainText(protocol.payoffCadence?.mode) as
        | 'fast'
        | 'steady'
        | 'slow_burn'
        | 'suppressed_then_burst')
    : 'steady';

  return {
    readerPromise: toPlainText(protocol.readerPromise),
    targetEmotion: normalizeTargetEmotion(protocol.targetEmotion),
    coreDesire: toPlainText(protocol.coreDesire),
    protagonistDrive: toPlainText(protocol.protagonistDrive),
    hookEngine: toPlainText(protocol.hookEngine),
    payoffCadence: {
      mode,
      minorPayoffEveryChapters,
      majorPayoffEveryChapters,
      payoffTypes: normalizePayoffTypes(protocol.payoffCadence?.payoffTypes),
    },
    tropeContract: normalizeTropeContract(protocol.tropeContract),
    antiClicheRules: (Array.isArray(protocol.antiClicheRules)
      ? protocol.antiClicheRules
      : [protocol.antiClicheRules]
    )
      .map((rule) => toPlainText(rule))
      .filter(Boolean),
    longTermQuestion: toPlainText(protocol.longTermQuestion),
  };
}

function normalizePayoffChangeTarget(value: unknown): PayoffChangeTarget {
  switch (value) {
    case 'plot':
    case 'relationship':
    case 'world':
    case 'character':
    case 'theme':
      return value;
    default:
      return 'plot';
  }
}

function normalizeChapterNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.round(value));
  }

  if (typeof value === 'string') {
    const match = value.match(/(\d+)/u);
    if (match) {
      return Math.max(1, Number(match[1]));
    }
  }

  return null;
}

function normalizeNarrativeBibleShape(
  bible: NarrativeBible,
  input: Pick<OutlineGenerationInput, 'targetChapters'>
): NarrativeBible {
  const endingState = (bible.endingState ?? {}) as Record<string, unknown> & {
    seriesEndVision?: unknown;
    emotionalLanding?: unknown;
    finalMoralImage?: unknown;
  };
  const characterArcs = (Array.isArray(bible.characterArcs)
    ? bible.characterArcs
    : []
  ).map((character) => ({
    id: toPlainText(character.id),
    name: toPlainText(character.name),
    roleType: normalizeRoleType(character.roleType),
    desire: toPlainText(character.desire),
    fear: toPlainText(character.fear),
    flaw: toPlainText(character.flaw),
    misbelief: toPlainText(character.misbelief),
    wound: firstNonEmptyString([toPlainText(character.wound)]) || null,
    externalGoal: toPlainText(character.externalGoal),
    internalNeed: toPlainText(character.internalNeed),
    arcDirection: normalizeArcDirection(character.arcDirection),
    decisionLogic: toPlainText(character.decisionLogic),
    lineWillNotCross:
      firstNonEmptyString([toPlainText(character.lineWillNotCross)]) || null,
    lineMayEventuallyCross:
      firstNonEmptyString([toPlainText(character.lineMayEventuallyCross)]) || null,
    currentArcPhase: toPlainText(character.currentArcPhase),
  }));
  const characterIds = new Set(characterArcs.map((character) => character.id));
  const relationshipEdges = (Array.isArray(bible.relationshipEdges)
    ? bible.relationshipEdges
    : []
  ).map((relationship) => ({
    id: toPlainText(relationship.id),
    fromCharacterId: toPlainText(relationship.fromCharacterId),
    toCharacterId: toPlainText(relationship.toCharacterId),
    visibleLabel: toPlainText(relationship.visibleLabel),
    hiddenTruth:
      firstNonEmptyString([toPlainText(relationship.hiddenTruth)]) || null,
    dependency:
      firstNonEmptyString([toPlainText(relationship.dependency)]) || null,
    debt: firstNonEmptyString([toPlainText(relationship.debt)]) || null,
    misunderstanding:
      firstNonEmptyString([toPlainText(relationship.misunderstanding)]) || null,
    affection:
      firstNonEmptyString([toPlainText(relationship.affection)]) || null,
    harmPattern:
      firstNonEmptyString([toPlainText(relationship.harmPattern)]) || null,
    sharedGoal:
      firstNonEmptyString([toPlainText(relationship.sharedGoal)]) || null,
    valueConflict:
      firstNonEmptyString([toPlainText(relationship.valueConflict)]) || null,
    trustLevel:
      typeof relationship.trustLevel === 'number' &&
      Number.isFinite(relationship.trustLevel)
        ? relationship.trustLevel
        : 0,
    tensionLevel:
      typeof relationship.tensionLevel === 'number' &&
      Number.isFinite(relationship.tensionLevel)
        ? relationship.tensionLevel
        : 0,
    currentState: toPlainText(relationship.currentState),
    plannedTurns: Array.isArray(relationship.plannedTurns)
      ? relationship.plannedTurns.map((turn) => ({
          chapterRange: toPlainText(turn.chapterRange),
          change: toPlainText(turn.change),
        }))
      : [],
  }));
  const relationshipIds = new Set(
    relationshipEdges.map((relationship) => relationship.id)
  );

  return {
    premise: toPlainText(bible.premise),
    genreContract: toPlainText(bible.genreContract),
    targetReaderExperience: toPlainText(bible.targetReaderExperience),
    themeQuestion: toPlainText(bible.themeQuestion),
    themeAnswerDirection: toPlainText(bible.themeAnswerDirection),
    centralDramaticQuestion: toPlainText(bible.centralDramaticQuestion),
    endingState: {
      protagonistWins: firstNonEmptyString([
        toPlainText(endingState.protagonistWins),
        toPlainText(endingState.seriesEndVision),
      ]),
      protagonistLoses: firstNonEmptyString([
        toPlainText(endingState.protagonistLoses),
        toPlainText(endingState.emotionalLanding),
      ]),
      worldChange: firstNonEmptyString([
        toPlainText(endingState.worldChange),
        toPlainText(endingState.seriesEndVision),
      ]),
      relationshipOutcome: firstNonEmptyString([
        toPlainText(endingState.relationshipOutcome),
        toPlainText(endingState.emotionalLanding),
      ]),
      themeAnswer: firstNonEmptyString([
        toPlainText(endingState.themeAnswer),
        toPlainText(endingState.finalMoralImage),
      ]),
    },
    voiceGuide: toPlainText(bible.voiceGuide),
    characterArcs,
    relationshipEdges,
    worldRules: (Array.isArray(bible.worldRules) ? bible.worldRules : []).map(
      (rule) => ({
        id: toPlainText(rule.id),
        category: normalizeWorldRuleCategory(rule.category),
        ruleText: toPlainText(rule.ruleText),
        cost: toPlainText(rule.cost),
        whoBenefits:
          firstNonEmptyString([toPlainText(rule.whoBenefits)]) || null,
        whoSuffers:
          firstNonEmptyString([toPlainText(rule.whoSuffers)]) || null,
        taboo: firstNonEmptyString([toPlainText(rule.taboo)]) || null,
        violationConsequence:
          firstNonEmptyString([toPlainText(rule.violationConsequence)]) || null,
        allowedException:
          firstNonEmptyString([toPlainText(rule.allowedException)]) || null,
        currentStatus: toPlainText(rule.currentStatus),
      })
    ),
    narrativeThreads: (Array.isArray(bible.narrativeThreads)
      ? bible.narrativeThreads
      : []
    ).map((thread, index) => {
      const normalizedExpectedPayoff = normalizeChapterNumber(
        thread.expectedPayoff
      );

      return {
        id: toPlainText(thread.id),
        type:
          index === 0 && normalizeThreadType(thread.type) !== 'main'
            ? 'main'
            : normalizeThreadType(thread.type),
        promise: toPlainText(thread.promise),
        plantedAt: normalizeChapterNumber(thread.plantedAt) ?? 1,
        expectedPayoff:
          normalizedExpectedPayoff !== null &&
          normalizedExpectedPayoff <= input.targetChapters
            ? normalizedExpectedPayoff
            : null,
        resolvedAt: normalizeChapterNumber(thread.resolvedAt),
        currentState: normalizeThreadState(thread.currentState),
        importance: normalizeThreadImportance(thread.importance),
        payoffMustChange: normalizePayoffChangeTarget(thread.payoffMustChange),
        ownerCharacterId: characterIds.has(toPlainText(thread.ownerCharacterId))
          ? toPlainText(thread.ownerCharacterId)
          : null,
        relatedRelationshipId: relationshipIds.has(
          toPlainText(thread.relatedRelationshipId)
        )
          ? toPlainText(thread.relatedRelationshipId)
          : null,
        notes: firstNonEmptyString([toPlainText(thread.notes)]) || null,
      };
    }),
    viralStoryProtocol: normalizeViralStoryProtocolShape(
      bible.viralStoryProtocol
    ),
  };
}

function normalizeVolumePlansShape(
  plans: VolumePlan[]
): VolumePlan[] {
  return (Array.isArray(plans) ? plans : []).map((plan, index) => ({
    volumeIndex:
      typeof plan.volumeIndex === 'number' && Number.isFinite(plan.volumeIndex)
        ? plan.volumeIndex
        : index + 1,
    title: toPlainText(plan.title),
    chapterStart: normalizeChapterNumber(plan.chapterStart) ?? index + 1,
    chapterEnd: normalizeChapterNumber(plan.chapterEnd) ?? index + 1,
    roleInStory: toPlainText(plan.roleInStory),
    mainPressure: toPlainText(plan.mainPressure),
    promisedPayoff: toPlainText(plan.promisedPayoff),
    characterArcMovement: toPlainText(plan.characterArcMovement),
    relationshipMovement: toPlainText(plan.relationshipMovement),
    worldExpansion: toPlainText(plan.worldExpansion),
    endingTurn: toPlainText(plan.endingTurn),
  }));
}

function normalizeReaderReward(value: unknown): ReaderReward {
  const normalized = toPlainText(value);

  switch (normalized) {
    case 'reversal':
    case 'breakthrough':
    case 'failure':
    case 'truth':
    case 'upgrade':
    case 'confession':
    case 'dread':
    case 'relief':
      return normalized;
    default:
      return 'truth';
  }
}

function normalizeChapterCardsShape(input: {
  bookId: string;
  cards: Array<Omit<ChapterCard, 'bookId'> & { bookId?: string }>;
}): ChapterCard[] {
  return (Array.isArray(input.cards) ? input.cards : []).map((card, index) => ({
    bookId: input.bookId,
    volumeIndex:
      typeof card.volumeIndex === 'number' && Number.isFinite(card.volumeIndex)
        ? card.volumeIndex
        : 1,
    chapterIndex:
      typeof card.chapterIndex === 'number' && Number.isFinite(card.chapterIndex)
        ? card.chapterIndex
        : index + 1,
    title: toPlainText(card.title),
    plotFunction: toPlainText(card.plotFunction),
    povCharacterId: firstNonEmptyString([toPlainText(card.povCharacterId)]) || null,
    externalConflict: toPlainText(card.externalConflict),
    internalConflict: toPlainText(card.internalConflict),
    relationshipChange: toPlainText(card.relationshipChange),
    worldRuleUsedOrTested: toPlainText(card.worldRuleUsedOrTested),
    informationReveal: toPlainText(card.informationReveal),
    readerReward: normalizeReaderReward(card.readerReward),
    endingHook: toPlainText(card.endingHook),
    mustChange: toPlainText(card.mustChange),
    forbiddenMoves: (Array.isArray(card.forbiddenMoves)
      ? card.forbiddenMoves
      : [card.forbiddenMoves]
    )
      .map((item) => toPlainText(item))
      .filter(Boolean),
  }));
}

function normalizeThreadActionType(value: unknown): ThreadAction {
  switch (value) {
    case 'plant':
    case 'advance':
    case 'misdirect':
    case 'payoff':
      return value;
    default:
      return 'advance';
  }
}

function normalizeRelationshipActionType(
  value: unknown
): RelationshipAction {
  switch (value) {
    case 'strain':
    case 'repair':
    case 'betray':
    case 'reveal':
    case 'deepen':
    case 'reverse':
      return value;
    default:
      return 'deepen';
  }
}

function normalizeChapterThreadActionsShape(input: {
  bookId: string;
  chapterCards: ChapterCard[];
  actions: unknown;
}): ChapterThreadAction[] {
  return (Array.isArray(input.actions) ? input.actions : [])
    .map((action) => {
      if (!action || typeof action !== 'object') {
        return null;
      }

      const record = action as Record<string, unknown>;
      const chapterIndex =
        normalizeChapterNumber(record.chapterIndex) ??
        normalizeChapterNumber(record.chapter) ??
        null;
      const card = input.chapterCards.find(
        (candidate) => candidate.chapterIndex === chapterIndex
      );

      if (!card) {
        return null;
      }

      return {
        bookId: input.bookId,
        volumeIndex: card.volumeIndex,
        chapterIndex: card.chapterIndex,
        threadId: firstNonEmptyString([
          toPlainText(record.threadId),
          toPlainText(record.id),
        ]),
        action: normalizeThreadActionType(record.action),
        requiredEffect: firstNonEmptyString([
          toPlainText(record.requiredEffect),
          toPlainText(record.detail),
          toPlainText(record.effect),
        ]),
      };
    })
    .filter((action): action is ChapterThreadAction => {
      if (!action) {
        return false;
      }

      return Boolean(action.threadId) && Boolean(action.requiredEffect);
    });
}

function normalizeChapterCharacterPressuresShape(input: {
  bookId: string;
  chapterCards: ChapterCard[];
  pressures: unknown;
}): ChapterCharacterPressure[] {
  return (Array.isArray(input.pressures) ? input.pressures : [])
    .map((pressure) => {
      if (!pressure || typeof pressure !== 'object') {
        return null;
      }

      const record = pressure as Record<string, unknown>;
      const chapterIndex =
        normalizeChapterNumber(record.chapterIndex) ??
        normalizeChapterNumber(record.chapter) ??
        null;
      const card = input.chapterCards.find(
        (candidate) => candidate.chapterIndex === chapterIndex
      );

      if (!card) {
        return null;
      }

      const list = Array.isArray(record.pressures)
        ? record.pressures.map((item) => toPlainText(item)).filter(Boolean)
        : [];

      return {
        bookId: input.bookId,
        volumeIndex: card.volumeIndex,
        chapterIndex: card.chapterIndex,
        characterId: firstNonEmptyString([
          toPlainText(record.characterId),
          toPlainText(record.id),
        ]),
        desirePressure: list[0] ?? firstNonEmptyString([toPlainText(record.desirePressure)]),
        fearPressure: list[1] ?? firstNonEmptyString([toPlainText(record.fearPressure)]),
        flawTrigger: list[2] ?? firstNonEmptyString([toPlainText(record.flawTrigger)]),
        expectedChoice:
          list[3] ??
          firstNonEmptyString([
            toPlainText(record.expectedChoice),
            card.mustChange,
          ]),
      };
    })
    .filter((pressure): pressure is ChapterCharacterPressure => {
      if (!pressure) {
        return false;
      }

      return (
        Boolean(pressure.characterId) &&
        Boolean(pressure.desirePressure) &&
        Boolean(pressure.fearPressure) &&
        Boolean(pressure.flawTrigger) &&
        Boolean(pressure.expectedChoice)
      );
    });
}

function normalizeChapterRelationshipActionsShape(input: {
  bookId: string;
  chapterCards: ChapterCard[];
  actions: unknown;
}): ChapterRelationshipAction[] {
  return (Array.isArray(input.actions) ? input.actions : [])
    .map((action) => {
      if (!action || typeof action !== 'object') {
        return null;
      }

      const record = action as Record<string, unknown>;
      const chapterIndex =
        normalizeChapterNumber(record.chapterIndex) ??
        normalizeChapterNumber(record.chapter) ??
        null;
      const card = input.chapterCards.find(
        (candidate) => candidate.chapterIndex === chapterIndex
      );

      if (!card) {
        return null;
      }

      return {
        bookId: input.bookId,
        volumeIndex: card.volumeIndex,
        chapterIndex: card.chapterIndex,
        relationshipId: firstNonEmptyString([
          toPlainText(record.relationshipId),
          [
            toPlainText(record.fromCharacterId),
            toPlainText(record.toCharacterId),
          ]
            .filter(Boolean)
            .join('-'),
        ]),
        action: normalizeRelationshipActionType(record.action),
        requiredChange: firstNonEmptyString([
          toPlainText(record.requiredChange),
          toPlainText(record.detail),
        ]),
      };
    })
    .filter((action): action is ChapterRelationshipAction => {
      if (!action) {
        return false;
      }

      return Boolean(action.relationshipId) && Boolean(action.requiredChange);
    });
}

function renderWorldSettingFromBible(
  bible: NarrativeBible,
  input: Pick<OutlineGenerationInput, 'targetChapters' | 'wordsPerChapter'>
) {
  return [
    `目标总章数：${input.targetChapters}`,
    `每章字数：${input.wordsPerChapter}`,
    `故事前提：${bible.premise}`,
    `题材契约：${bible.genreContract}`,
    `读者体验：${bible.targetReaderExperience}`,
    `主题问题：${bible.themeQuestion}`,
    `主题答案方向：${bible.themeAnswerDirection}`,
    `核心戏剧问题：${bible.centralDramaticQuestion}`,
    `语气指南：${bible.voiceGuide}`,
    '世界规则：',
    ...bible.worldRules.map(
      (rule) => `${rule.id}：${rule.ruleText}；代价=${rule.cost}`
    ),
  ].join('\n');
}

function renderMasterOutlineFromPlans(
  bible: NarrativeBible,
  volumePlans: VolumePlan[]
) {
  return [
    `Central dramatic question: ${bible.centralDramaticQuestion}`,
    ...volumePlans.map(
      (volume) =>
        `Volume ${volume.volumeIndex} ${volume.title}: chapters ${volume.chapterStart}-${volume.chapterEnd}; payoff=${volume.promisedPayoff}; ending=${volume.endingTurn}`
    ),
  ].join('\n');
}

function chapterOutlinesFromCards(cards: ChapterCard[]): ChapterOutline[] {
  return cards.map((card) => ({
    volumeIndex: card.volumeIndex,
    chapterIndex: card.chapterIndex,
    title: card.title,
    outline: [
      card.plotFunction,
      `必须变化：${card.mustChange}`,
      `外部冲突：${card.externalConflict}`,
      `内部冲突：${card.internalConflict}`,
      `关系变化：${card.relationshipChange}`,
      `章末钩子：${card.endingHook}`,
    ].join('\n'),
  }));
}

function bibleSummary(bible: NarrativeBible) {
  return [
    `premise: ${bible.premise}`,
    `themeQuestion: ${bible.themeQuestion}`,
    `themeAnswerDirection: ${bible.themeAnswerDirection}`,
    `characters: ${bible.characterArcs.map((character) => `${character.id}/${character.name}`).join(', ')}`,
    `worldRules: ${bible.worldRules.map((rule) => `${rule.id}: ${rule.ruleText}; cost=${rule.cost}`).join('; ')}`,
    `threads: ${bible.narrativeThreads.map((thread) => `${thread.id}: ${thread.promise}`).join('; ')}`,
  ].join('\n');
}

function volumePlansText(volumePlans: VolumePlan[]) {
  return volumePlans
    .map(
      (volume) =>
        `Volume ${volume.volumeIndex}: ${volume.title}, chapters ${volume.chapterStart}-${volume.chapterEnd}, payoff=${volume.promisedPayoff}`
    )
    .join('\n');
}

function chapterCardsText(cards: ChapterCard[]) {
  return cards
    .map(
      (card) =>
        `Chapter ${card.chapterIndex}: ${card.title}; function=${card.plotFunction}; mustChange=${card.mustChange}; readerReward=${card.readerReward}; endingHook=${card.endingHook}`
    )
    .join('\n');
}

export function createAiOutlineService(deps: {
  registry: {
    languageModel: (modelId: string) => unknown;
  };
  generateText: (input: {
    model: unknown;
    prompt: string;
  }) => Promise<{ text: string }>;
}) {
  return {
    async generateTitleFromIdea(
      input: OutlineGenerationInput & { modelId: string }
    ): Promise<string> {
      const model = deps.registry.languageModel(input.modelId);

      return normalizeGeneratedTitle(
        (
          await deps.generateText({
            model,
            prompt: buildTitlePrompt(input),
          })
        ).text
      );
    },

    async generateFromIdea(
      input: OutlineGenerationInput & { modelId: string }
    ): Promise<OutlineBundle> {
      const model = deps.registry.languageModel(input.modelId);

      const biblePrompt = buildNarrativeBiblePrompt(input);
      const bibleText = (
        await deps.generateText({
          model,
          prompt: biblePrompt,
        })
      ).text;

      let narrativeBible: NarrativeBible | null = null;
      try {
        narrativeBible = parseJsonObject<NarrativeBible>(bibleText);
      } catch {
        narrativeBible = null;
      }

      if (narrativeBible) {
        narrativeBible = normalizeNarrativeBibleShape(narrativeBible, {
          targetChapters: input.targetChapters,
        });
        const bibleValidation = validateNarrativeBible(narrativeBible, {
          targetChapters: input.targetChapters,
        });
        if (!bibleValidation.valid) {
          throw new Error(`Invalid narrative bible: ${bibleValidation.issues.join('; ')}`);
        }
        const viralStoryProtocol = deriveViralStoryProtocol(narrativeBible, {
          targetChapters: input.targetChapters,
          viralStrategy: input.viralStrategy ?? null,
        });
        narrativeBible = {
          ...narrativeBible,
          viralStoryProtocol,
        };

        const worldSetting = renderWorldSettingFromBible(
          narrativeBible,
          input
        );
        input.onWorldSetting?.(worldSetting);

        const volumePlans = normalizeVolumePlansShape(
          parseJsonObject<VolumePlan[]>(
            (
              await deps.generateText({
                model,
                prompt: buildVolumePlanPrompt({
                  targetChapters: input.targetChapters,
                  bibleSummary: bibleSummary(narrativeBible),
                  viralStoryProtocol,
                }),
              })
            ).text
          )
        );
        const volumeValidation = validateVolumePlans(volumePlans, {
          targetChapters: input.targetChapters,
        });
        if (!volumeValidation.valid) {
          throw new Error(`Invalid volume plans: ${volumeValidation.issues.join('; ')}`);
        }

        const masterOutline = renderMasterOutlineFromPlans(
          narrativeBible,
          volumePlans
        );
        input.onMasterOutline?.(masterOutline);

        const cardBundle = parseJsonObject<{
          cards: Array<Omit<ChapterCard, 'bookId'> & { bookId?: string }>;
          threadActions?: ChapterThreadAction[];
          characterPressures?: ChapterCharacterPressure[];
          relationshipActions?: ChapterRelationshipAction[];
        }>(
          (
            await deps.generateText({
              model,
              prompt: buildChapterCardPrompt({
                bookId: input.bookId,
                targetChapters: input.targetChapters,
                bibleSummary: bibleSummary(narrativeBible),
                volumePlansText: volumePlansText(volumePlans),
                viralStoryProtocol,
              }),
            })
          ).text
        );
        const chapterCards = normalizeChapterCardsShape({
          bookId: input.bookId,
          cards: cardBundle.cards ?? [],
        });
        const cardValidation = validateChapterCards(chapterCards, {
          targetChapters: input.targetChapters,
        });
        if (!cardValidation.valid) {
          throw new Error(`Invalid chapter cards: ${cardValidation.issues.join('; ')}`);
        }

        const generatedTensionBudgets = parseJsonObject<
          Array<Omit<ChapterTensionBudget, 'bookId'> & { bookId?: string }>
        >(
          (
            await deps.generateText({
              model,
              prompt: buildTensionBudgetPrompt({
                bookId: input.bookId,
                targetChapters: input.targetChapters,
                bibleSummary: bibleSummary(narrativeBible),
                volumePlansText: volumePlansText(volumePlans),
                chapterCardsText: chapterCardsText(chapterCards),
                viralStoryProtocol,
              }),
            })
          ).text
        );
        const chapterTensionBudgets = generatedTensionBudgets.map((budget) => ({
          ...budget,
          bookId: input.bookId,
        })) as ChapterTensionBudget[];
        const tensionBudgetValidation = validateTensionBudgets(
          chapterTensionBudgets,
          {
            targetChapters: input.targetChapters,
          }
        );
        if (!tensionBudgetValidation.valid) {
          throw new Error(
            `Invalid tension budgets: ${tensionBudgetValidation.issues.join('; ')}`
          );
        }

        const chapterOutlines = chapterOutlinesFromCards(chapterCards);
        input.onChapterOutlines?.(chapterOutlines);

        return {
          worldSetting,
          masterOutline,
          volumeOutlines: volumePlans.map(
            (volume) =>
              `第${volume.volumeIndex}卷：${volume.title}（第${volume.chapterStart}-${volume.chapterEnd}章）`
          ),
          chapterOutlines,
          narrativeBible,
          volumePlans,
          chapterCards,
          chapterTensionBudgets,
          chapterThreadActions: normalizeChapterThreadActionsShape({
            bookId: input.bookId,
            chapterCards,
            actions: cardBundle.threadActions,
          }),
          chapterCharacterPressures: normalizeChapterCharacterPressuresShape({
            bookId: input.bookId,
            chapterCards,
            pressures: cardBundle.characterPressures,
          }),
          chapterRelationshipActions: normalizeChapterRelationshipActionsShape({
            bookId: input.bookId,
            chapterCards,
            actions: cardBundle.relationshipActions,
          }),
        };
      }

      const worldSetting = normalizePlainContextText(
        (
          await deps.generateText({
            model,
            prompt: buildWorldPrompt(input),
          })
        ).text
      );
      input.onWorldSetting?.(worldSetting);

      const masterOutline = (
        await deps.generateText({
          model,
          prompt: buildMasterOutlinePrompt(worldSetting, input),
        })
      ).text;
      input.onMasterOutline?.(masterOutline);

      const volumeOutlineText = (
        await deps.generateText({
          model,
          prompt: buildVolumeOutlinePrompt(masterOutline, input),
        })
      ).text;

      const volumeOutlines = volumeOutlineText
        .split('\n---\n')
        .map((outline) => outline.trim())
        .filter(Boolean);

      const chapterOutlines: ChapterOutline[] = [];

      for (const [index, volumeOutline] of volumeOutlines.entries()) {
        if (chapterOutlines.length >= input.targetChapters) {
          break;
        }

        const chapterText = (
          await deps.generateText({
            model,
            prompt: buildChapterOutlinePrompt(volumeOutline, index + 1, input),
          })
        ).text;

        const nextChapterOutlines = renumberChapterOutlinesFrom(
          takeChapterOutlinesWithinTarget({
            chapterOutlines: parseChapterOutlineLines(chapterText, index + 1),
            emittedCount: chapterOutlines.length,
            targetChapters: input.targetChapters,
          }),
          chapterOutlines.length + 1
        );

        if (nextChapterOutlines.length > 0) {
          chapterOutlines.push(...nextChapterOutlines);
          input.onChapterOutlines?.(nextChapterOutlines);
        }
      }

      const normalizedChapterOutlines = normalizeChapterOutlinesToTarget(
        chapterOutlines,
        input.targetChapters
      );
      const missingChapterOutlines = normalizedChapterOutlines.slice(
        chapterOutlines.length
      );
      if (missingChapterOutlines.length > 0) {
        input.onChapterOutlines?.(missingChapterOutlines);
      }

      return {
        worldSetting,
        masterOutline,
        volumeOutlines,
        chapterOutlines: normalizedChapterOutlines,
      };
    },
  };
}
