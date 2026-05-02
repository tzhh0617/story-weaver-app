import type {
  ArcDirection,
  CharacterRoleType,
  NarrativeBible,
  NarrativeThreadState,
  NarrativeThreadType,
  PayoffChangeTarget,
  ThreadImportance,
  WorldRuleCategory,
} from './types.js';

function normalizeText(value: unknown) {
  return coerceText(value).toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(coerceText).filter(Boolean).join('；');
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, nestedValue]) => {
        const text = coerceText(nestedValue);
        return text ? `${key}：${text}` : '';
      })
      .filter(Boolean)
      .join('；');
  }
  return '';
}

function nullableText(value: unknown) {
  const text = coerceText(value);
  return text || null;
}

function normalizeNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeNullableChapter(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const normalized = normalizeNumber(value, Number.NaN);
  return Number.isFinite(normalized) ? normalized : null;
}

function hasAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function normalizeCharacterRoleType(value: unknown): CharacterRoleType {
  const normalized = normalizeText(value);
  if (
    normalized === 'protagonist' ||
    normalized === 'deuteragonist' ||
    normalized === 'supporting' ||
    normalized === 'antagonist' ||
    normalized === 'minor'
  ) {
    return normalized;
  }
  if (hasAny(normalized, ['protagonist', 'hero', '主角'])) return 'protagonist';
  if (hasAny(normalized, ['antagonist', 'enemy', 'villain', '反派'])) {
    return 'antagonist';
  }
  if (hasAny(normalized, ['deuteragonist', '副主角'])) return 'deuteragonist';
  if (hasAny(normalized, ['minor', '路人', '配角'])) return 'minor';
  return 'supporting';
}

function normalizeArcDirection(value: unknown): ArcDirection {
  const normalized = normalizeText(value);
  if (
    normalized === 'growth' ||
    normalized === 'fall' ||
    normalized === 'corruption' ||
    normalized === 'recovery' ||
    normalized === 'flat'
  ) {
    return normalized;
  }
  if (hasAny(normalized, ['corrupt', '堕落', '黑化'])) return 'corruption';
  if (hasAny(normalized, ['fall', 'decline', '坠落', '失败'])) return 'fall';
  if (hasAny(normalized, ['recover', 'heal', '恢复', '疗愈'])) return 'recovery';
  if (hasAny(normalized, ['flat', 'static', '稳定', '不变'])) return 'flat';
  return 'growth';
}

function normalizeWorldRuleCategory(value: unknown): WorldRuleCategory {
  const normalized = normalizeText(value);
  if (
    normalized === 'power' ||
    normalized === 'society' ||
    normalized === 'resource' ||
    normalized === 'taboo' ||
    normalized === 'law' ||
    normalized === 'daily_life' ||
    normalized === 'history'
  ) {
    return normalized;
  }
  if (hasAny(normalized, ['law', 'rule', '秩序', '规则'])) return 'law';
  if (hasAny(normalized, ['society', 'human', 'condition', '社会', '人'])) {
    return 'society';
  }
  if (hasAny(normalized, ['resource', 'artifact', 'item', '物品', '道具'])) {
    return 'resource';
  }
  if (hasAny(normalized, ['taboo', 'forbidden', '禁忌'])) return 'taboo';
  if (hasAny(normalized, ['daily', 'life', '日常'])) return 'daily_life';
  if (hasAny(normalized, ['history', 'backstory', 'past', '历史'])) {
    return 'history';
  }
  return 'power';
}

function normalizeThreadType(value: unknown): NarrativeThreadType {
  const normalized = normalizeText(value);
  if (
    normalized === 'main' ||
    normalized === 'subplot' ||
    normalized === 'relationship' ||
    normalized === 'mystery' ||
    normalized === 'theme' ||
    normalized === 'antagonist' ||
    normalized === 'world'
  ) {
    return normalized;
  }
  if (hasAny(normalized, ['main', 'primary', '主线'])) return 'main';
  if (hasAny(normalized, ['relationship', '关系', '情感'])) return 'relationship';
  if (hasAny(normalized, ['mystery', 'revelation', 'backstory', '谜', '真相'])) {
    return 'mystery';
  }
  if (hasAny(normalized, ['theme', '主题'])) return 'theme';
  if (hasAny(normalized, ['antagonist', 'pressure', '反派', '压迫'])) {
    return 'antagonist';
  }
  if (hasAny(normalized, ['world', '世界'])) return 'world';
  return 'subplot';
}

function normalizeThreadState(value: unknown): NarrativeThreadState {
  const normalized = normalizeText(value);
  if (
    normalized === 'open' ||
    normalized === 'advanced' ||
    normalized === 'twisted' ||
    normalized === 'paid_off' ||
    normalized === 'abandoned'
  ) {
    return normalized;
  }
  if (hasAny(normalized, ['twist', '反转'])) return 'twisted';
  if (hasAny(normalized, ['pay', 'resolve', '兑现', '解决'])) return 'paid_off';
  if (hasAny(normalized, ['abandon', '放弃'])) return 'abandoned';
  if (hasAny(normalized, ['advance', '推进'])) return 'advanced';
  return 'open';
}

function normalizeImportance(value: unknown): ThreadImportance {
  const normalized = normalizeText(value);
  if (normalized === 'critical' || normalized === 'normal' || normalized === 'minor') {
    return normalized;
  }
  if (hasAny(normalized, ['critical', 'high', 'urgent', '核心', '重要'])) {
    return 'critical';
  }
  if (hasAny(normalized, ['minor', 'low', '次要'])) return 'minor';
  return 'normal';
}

function normalizePayoffChangeTarget(value: unknown): PayoffChangeTarget {
  const normalized = normalizeText(value);
  if (
    normalized === 'plot' ||
    normalized === 'relationship' ||
    normalized === 'world' ||
    normalized === 'character' ||
    normalized === 'theme'
  ) {
    return normalized;
  }
  if (hasAny(normalized, ['relationship', 'trust', '信任', '关系'])) {
    return 'relationship';
  }
  if (hasAny(normalized, ['world', 'rule', 'city', 'time', '规则', '世界'])) {
    return 'world';
  }
  if (hasAny(normalized, ['character', 'memory', 'choice', 'arc', '主角', '记忆', '选择'])) {
    return 'character';
  }
  if (hasAny(normalized, ['theme', 'truth', 'meaning', '愿望', '真相', '主题'])) {
    return 'theme';
  }
  return 'plot';
}

export function normalizeNarrativeBible(bible: NarrativeBible): NarrativeBible {
  const narrativeThreads = Array.isArray(bible.narrativeThreads)
    ? bible.narrativeThreads.map((thread) => ({
        ...thread,
        id: coerceText(thread.id),
        type: normalizeThreadType(thread.type),
        promise: coerceText(thread.promise),
        plantedAt: normalizeNumber(thread.plantedAt, 1),
        expectedPayoff: normalizeNullableChapter(thread.expectedPayoff),
        resolvedAt: normalizeNullableChapter(thread.resolvedAt),
        currentState: normalizeThreadState(thread.currentState),
        importance: normalizeImportance(thread.importance),
        payoffMustChange: normalizePayoffChangeTarget(thread.payoffMustChange),
        ownerCharacterId: nullableText(thread.ownerCharacterId),
        relatedRelationshipId: nullableText(thread.relatedRelationshipId),
        notes: nullableText(thread.notes),
      }))
    : bible.narrativeThreads;

  if (
    Array.isArray(narrativeThreads) &&
    narrativeThreads.length > 0 &&
    !narrativeThreads.some((thread) => thread.type === 'main')
  ) {
    narrativeThreads[0] = {
      ...narrativeThreads[0],
      type: 'main',
    };
  }

  return {
    ...bible,
    premise: coerceText(bible.premise),
    genreContract: coerceText(bible.genreContract),
    targetReaderExperience: coerceText(bible.targetReaderExperience),
    themeQuestion: coerceText(bible.themeQuestion),
    themeAnswerDirection: coerceText(bible.themeAnswerDirection),
    centralDramaticQuestion: coerceText(bible.centralDramaticQuestion),
    endingState: {
      protagonistWins: coerceText(bible.endingState?.protagonistWins),
      protagonistLoses: coerceText(bible.endingState?.protagonistLoses),
      worldChange: coerceText(bible.endingState?.worldChange),
      relationshipOutcome: coerceText(bible.endingState?.relationshipOutcome),
      themeAnswer: coerceText(bible.endingState?.themeAnswer),
    },
    voiceGuide: coerceText(bible.voiceGuide),
    characterArcs: Array.isArray(bible.characterArcs)
      ? bible.characterArcs.map((character) => ({
          ...character,
          id: coerceText(character.id),
          name: coerceText(character.name),
          roleType: normalizeCharacterRoleType(character.roleType),
          desire: coerceText(character.desire),
          fear: coerceText(character.fear),
          flaw: coerceText(character.flaw),
          misbelief: coerceText(character.misbelief),
          wound: nullableText(character.wound),
          externalGoal: coerceText(character.externalGoal),
          internalNeed: coerceText(character.internalNeed),
          arcDirection: normalizeArcDirection(character.arcDirection),
          decisionLogic: coerceText(character.decisionLogic),
          lineWillNotCross: nullableText(character.lineWillNotCross),
          lineMayEventuallyCross: nullableText(character.lineMayEventuallyCross),
          currentArcPhase: coerceText(character.currentArcPhase),
        }))
      : bible.characterArcs,
    relationshipEdges: Array.isArray(bible.relationshipEdges)
      ? bible.relationshipEdges.map((relationship) => ({
          ...relationship,
          id: coerceText(relationship.id),
          fromCharacterId: coerceText(relationship.fromCharacterId),
          toCharacterId: coerceText(relationship.toCharacterId),
          visibleLabel: coerceText(relationship.visibleLabel),
          hiddenTruth: nullableText(relationship.hiddenTruth),
          dependency: nullableText(relationship.dependency),
          debt: nullableText(relationship.debt),
          misunderstanding: nullableText(relationship.misunderstanding),
          affection: nullableText(relationship.affection),
          harmPattern: nullableText(relationship.harmPattern),
          sharedGoal: nullableText(relationship.sharedGoal),
          valueConflict: nullableText(relationship.valueConflict),
          trustLevel: normalizeNumber(relationship.trustLevel, 0),
          tensionLevel: normalizeNumber(relationship.tensionLevel, 0),
          currentState: coerceText(relationship.currentState),
          plannedTurns: Array.isArray(relationship.plannedTurns)
            ? relationship.plannedTurns.map((turn) => ({
                chapterRange: coerceText(turn.chapterRange),
                change: coerceText(turn.change),
              }))
            : [],
        }))
      : bible.relationshipEdges,
    worldRules: Array.isArray(bible.worldRules)
      ? bible.worldRules.map((rule) => ({
          ...rule,
          id: coerceText(rule.id),
          category: normalizeWorldRuleCategory(rule.category),
          ruleText: coerceText(rule.ruleText),
          cost: coerceText(rule.cost),
          whoBenefits: nullableText(rule.whoBenefits),
          whoSuffers: nullableText(rule.whoSuffers),
          taboo: nullableText(rule.taboo),
          violationConsequence: nullableText(rule.violationConsequence),
          allowedException: nullableText(rule.allowedException),
          currentStatus: coerceText(rule.currentStatus),
        }))
      : bible.worldRules,
    narrativeThreads,
    viralStoryProtocol: undefined,
  };
}
