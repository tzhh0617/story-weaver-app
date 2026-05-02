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
  return String(value ?? '').trim().toLowerCase();
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
        type: normalizeThreadType(thread.type),
        currentState: normalizeThreadState(thread.currentState),
        importance: normalizeImportance(thread.importance),
        payoffMustChange: normalizePayoffChangeTarget(thread.payoffMustChange),
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
    characterArcs: Array.isArray(bible.characterArcs)
      ? bible.characterArcs.map((character) => ({
          ...character,
          roleType: normalizeCharacterRoleType(character.roleType),
          arcDirection: normalizeArcDirection(character.arcDirection),
        }))
      : bible.characterArcs,
    worldRules: Array.isArray(bible.worldRules)
      ? bible.worldRules.map((rule) => ({
          ...rule,
          category: normalizeWorldRuleCategory(rule.category),
        }))
      : bible.worldRules,
    narrativeThreads,
    viralStoryProtocol: undefined,
  };
}
