import type {
  NarrativeBible,
  ValidationResult,
  ViralPayoffCadence,
  ViralStrategyInput,
  ViralStoryProtocol,
  ViralTargetEmotion,
  ViralTropeContract,
} from './types.js';

function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function firstProtagonistDesire(bible: NarrativeBible) {
  return (
    bible.characterArcs.find((character) => character.roleType === 'protagonist')
      ?.desire ?? bible.centralDramaticQuestion
  );
}

function inferTargetEmotion(text: string): ViralTargetEmotion {
  if (includesAny(text, ['复仇', '反杀', '清算'])) return 'revenge';
  if (includesAny(text, ['悬疑', '真相', '旧案', '破案'])) {
    return 'mystery_breakthrough';
  }
  if (includesAny(text, ['生存', '逃亡', '末日'])) return 'survival';
  if (includesAny(text, ['甜宠', '偏爱', '心动'])) return 'romantic_tension';
  if (includesAny(text, ['权谋', '夺权', '掌权'])) return 'power_climb';
  if (includesAny(text, ['修仙', '神明', '异界'])) return 'wonder';
  return 'comeback';
}

function inferTropeContract(text: string): ViralTropeContract[] {
  const contracts: ViralTropeContract[] = [];
  if (includesAny(text, ['重生', '改命'])) contracts.push('rebirth_change_fate');
  if (includesAny(text, ['系统'])) contracts.push('system_growth');
  if (includesAny(text, ['身份', '伪装', '替身'])) contracts.push('hidden_identity');
  if (includesAny(text, ['复仇', '清算', '反杀'])) contracts.push('revenge_payback');
  if (includesAny(text, ['废柴', '逆袭', '升级', '修仙'])) contracts.push('weak_to_strong');
  if (includesAny(text, ['禁忌', '师徒', '宿敌'])) contracts.push('forbidden_bond');
  if (includesAny(text, ['悬疑', '破案', '旧案', '真相'])) contracts.push('case_breaking');
  if (includesAny(text, ['宗门', '家族'])) contracts.push('sect_or_family_pressure');
  if (includesAny(text, ['生存', '逃亡', '末日'])) contracts.push('survival_game');
  if (includesAny(text, ['权谋', '财团', '公司', '商战'])) {
    contracts.push('business_or_power_game');
  }
  return contracts.length ? [...new Set(contracts)] : ['weak_to_strong'];
}

function inferCadence(text: string, targetChapters: number): ViralPayoffCadence {
  if (includesAny(text, ['悬疑', '旧案', '破案'])) {
    return {
      mode: 'steady',
      minorPayoffEveryChapters: 2,
      majorPayoffEveryChapters: Math.max(8, Math.round(targetChapters / 10)),
      payoffTypes: ['truth_reveal', 'local_victory', 'enemy_setback'],
    };
  }

  if (includesAny(text, ['慢热', '压抑', '克制'])) {
    return {
      mode: 'suppressed_then_burst',
      minorPayoffEveryChapters: 3,
      majorPayoffEveryChapters: Math.max(10, Math.round(targetChapters / 8)),
      payoffTypes: ['truth_reveal', 'local_victory', 'enemy_setback'],
    };
  }

  return {
    mode: 'fast',
    minorPayoffEveryChapters: 2,
    majorPayoffEveryChapters: Math.max(6, Math.round(targetChapters / 12)),
    payoffTypes: ['face_slap', 'upgrade', 'local_victory'],
  };
}

export function deriveViralStoryProtocol(
  bible: NarrativeBible,
  input: { targetChapters: number; viralStrategy?: ViralStrategyInput | null }
): ViralStoryProtocol {
  if (bible.viralStoryProtocol) return bible.viralStoryProtocol;

  const combined = [
    bible.premise,
    bible.genreContract,
    bible.targetReaderExperience,
    bible.centralDramaticQuestion,
    bible.characterArcs.map((character) => character.desire).join(' '),
    bible.narrativeThreads.map((thread) => thread.promise).join(' '),
  ].join(' ');

  const coreDesire =
    input.viralStrategy?.protagonistDesire || firstProtagonistDesire(bible);
  const cadence = inferCadence(combined, input.targetChapters);

  return {
    readerPromise:
      input.viralStrategy?.readerPayoff ||
      bible.targetReaderExperience ||
      bible.genreContract,
    targetEmotion: inferTargetEmotion(
      input.viralStrategy?.readerPayoff
        ? `${input.viralStrategy.readerPayoff} ${combined}`
        : combined
    ),
    coreDesire,
    protagonistDrive: `主角持续主动行动，因为他必须${coreDesire}`,
    hookEngine:
      bible.narrativeThreads.find((thread) => thread.type === 'main')?.promise ??
      bible.centralDramaticQuestion,
    payoffCadence: {
      ...cadence,
      mode: input.viralStrategy?.cadenceMode || cadence.mode,
    },
    tropeContract:
      input.viralStrategy?.tropeContracts?.length
        ? input.viralStrategy.tropeContracts
        : inferTropeContract(combined),
    antiClicheRules: [
      ...(input.viralStrategy?.antiClicheDirection
        ? [input.viralStrategy.antiClicheDirection]
        : []),
      '每次翻盘必须付出记忆、关系、资源或身份代价。',
      '反派不能无理由降智，胜利必须来自主角选择和已铺设规则。',
      '熟悉套路必须通过人物独特选择或世界规则变形获得新鲜感。',
    ],
    longTermQuestion: bible.centralDramaticQuestion,
  };
}

export function validateViralStoryProtocol(
  protocol: ViralStoryProtocol
): ValidationResult {
  const issues: string[] = [];
  if (isBlank(protocol.readerPromise)) {
    issues.push('Viral story protocol must include readerPromise.');
  }
  if (isBlank(protocol.coreDesire)) {
    issues.push('Viral story protocol must include coreDesire.');
  }
  if (isBlank(protocol.hookEngine)) {
    issues.push('Viral story protocol must include hookEngine.');
  }
  if (isBlank(protocol.longTermQuestion)) {
    issues.push('Viral story protocol must include longTermQuestion.');
  }
  if (!protocol.payoffCadence.minorPayoffEveryChapters) {
    issues.push('Viral story protocol must include minor payoff cadence.');
  }
  if (!protocol.payoffCadence.majorPayoffEveryChapters) {
    issues.push('Viral story protocol must include major payoff cadence.');
  }
  return {
    valid: issues.length === 0,
    issues,
  };
}

export function getExpectedPayoffForChapter(
  protocol: ViralStoryProtocol,
  chapterIndex: number
) {
  if (chapterIndex % protocol.payoffCadence.majorPayoffEveryChapters === 0) {
    return 'major payoff';
  }
  if (chapterIndex % protocol.payoffCadence.minorPayoffEveryChapters === 0) {
    return 'minor payoff';
  }
  return 'pressure setup';
}

export function formatViralProtocolForPrompt(
  protocol: ViralStoryProtocol,
  input: { chapterIndex?: number | null } = {}
) {
  const chapterIndex = input.chapterIndex ?? null;
  return [
    'Viral Story Protocol',
    `Reader promise: ${protocol.readerPromise}`,
    `Target emotion: ${protocol.targetEmotion}`,
    `Core desire: ${protocol.coreDesire}`,
    `Protagonist drive: ${protocol.protagonistDrive}`,
    `Hook engine: ${protocol.hookEngine}`,
    `Payoff cadence: ${protocol.payoffCadence.mode}; minor every ${protocol.payoffCadence.minorPayoffEveryChapters} chapters; major every ${protocol.payoffCadence.majorPayoffEveryChapters} chapters`,
    `Payoff types: ${protocol.payoffCadence.payoffTypes.join(', ')}`,
    `Trope contract: ${protocol.tropeContract.join(', ')}`,
    `Long-term question: ${protocol.longTermQuestion}`,
    chapterIndex
      ? `Current chapter expected payoff: ${getExpectedPayoffForChapter(protocol, chapterIndex)}`
      : '',
    'Anti-cliche rules:',
    ...protocol.antiClicheRules.map((rule) => `- ${rule}`),
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}
