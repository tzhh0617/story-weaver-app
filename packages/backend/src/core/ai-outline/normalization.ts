import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterThreadAction,
  ReaderReward,
  VolumePlan,
} from '../narrative/types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function normalizeNonBlankString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();
  return text.length > 0 ? text : null;
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

function hasAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  if (isPositiveInteger(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (isPositiveInteger(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function normalizeVolumePlans(plans: unknown): VolumePlan[] {
  if (!Array.isArray(plans)) {
    return [];
  }

  return plans.map((plan, index) => {
    const record = isRecord(plan) ? plan : {};
    return {
      volumeIndex: normalizePositiveInteger(record.volumeIndex, index + 1),
      title: coerceText(record.title),
      chapterStart: normalizePositiveInteger(record.chapterStart, 1),
      chapterEnd: normalizePositiveInteger(record.chapterEnd, 1),
      roleInStory: coerceText(record.roleInStory),
      mainPressure: coerceText(record.mainPressure),
      promisedPayoff: coerceText(record.promisedPayoff),
      characterArcMovement: coerceText(record.characterArcMovement),
      relationshipMovement: coerceText(record.relationshipMovement),
      worldExpansion: coerceText(record.worldExpansion),
      endingTurn: coerceText(record.endingTurn),
    };
  });
}

function isReaderReward(value: unknown): value is ReaderReward {
  return (
    value === 'reversal' ||
    value === 'breakthrough' ||
    value === 'failure' ||
    value === 'truth' ||
    value === 'upgrade' ||
    value === 'confession' ||
    value === 'dread' ||
    value === 'relief'
  );
}

function normalizeReaderReward(value: unknown): ReaderReward {
  if (isReaderReward(value)) {
    return value;
  }

  const normalized = coerceText(value).toLowerCase();
  if (hasAny(normalized, ['reversal', 'reverse', 'twist', '反转', '逆转'])) {
    return 'reversal';
  }
  if (hasAny(normalized, ['breakthrough', '突破', '破局', '进展'])) {
    return 'breakthrough';
  }
  if (hasAny(normalized, ['failure', 'fail', '失败', '受挫', '落败'])) {
    return 'failure';
  }
  if (
    hasAny(normalized, [
      'truth',
      'reveal',
      'clue',
      'evidence',
      '真相',
      '揭示',
      '揭露',
      '线索',
      '证据',
      '目击',
      '明确',
    ])
  ) {
    return 'truth';
  }
  if (hasAny(normalized, ['upgrade', 'level', '升级', '增强', '变强'])) {
    return 'upgrade';
  }
  if (hasAny(normalized, ['confession', 'admit', '告白', '承认', '坦白'])) {
    return 'confession';
  }
  if (hasAny(normalized, ['dread', 'fear', 'threat', '恐惧', '威胁', '危机'])) {
    return 'dread';
  }
  if (hasAny(normalized, ['relief', 'safe', '缓解', '解脱', '安全'])) {
    return 'relief';
  }
  return 'truth';
}

export function normalizeChapterCards(
  bookId: string,
  cards: unknown
): ChapterCard[] {
  if (!Array.isArray(cards)) {
    return [];
  }

  return cards.map((card, index) => {
    const record = isRecord(card) ? card : {};
    return {
      bookId,
      volumeIndex: normalizePositiveInteger(record.volumeIndex, 1),
      chapterIndex: normalizePositiveInteger(record.chapterIndex, index + 1),
      title: coerceText(record.title),
      plotFunction: coerceText(record.plotFunction),
      povCharacterId: normalizeNonBlankString(record.povCharacterId),
      externalConflict: coerceText(record.externalConflict),
      internalConflict: coerceText(record.internalConflict),
      relationshipChange: coerceText(record.relationshipChange),
      worldRuleUsedOrTested: coerceText(record.worldRuleUsedOrTested),
      informationReveal: coerceText(record.informationReveal),
      readerReward: normalizeReaderReward(record.readerReward),
      endingHook: coerceText(record.endingHook),
      mustChange: coerceText(record.mustChange),
      forbiddenMoves: Array.isArray(record.forbiddenMoves)
        ? record.forbiddenMoves.map(coerceText).filter(Boolean)
        : [],
    };
  });
}

function isThreadAction(value: unknown): value is ChapterThreadAction['action'] {
  return (
    value === 'plant' ||
    value === 'advance' ||
    value === 'misdirect' ||
    value === 'payoff'
  );
}

function isRelationshipAction(
  value: unknown
): value is ChapterRelationshipAction['action'] {
  return (
    value === 'strain' ||
    value === 'repair' ||
    value === 'betray' ||
    value === 'reveal' ||
    value === 'deepen' ||
    value === 'reverse'
  );
}

export function normalizeChapterThreadActions(
  bookId: string,
  actions: unknown
): ChapterThreadAction[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  const normalized: ChapterThreadAction[] = [];
  for (const action of actions) {
    if (
      !isRecord(action) ||
      !isPositiveInteger(action.volumeIndex) ||
      !isPositiveInteger(action.chapterIndex) ||
      !isThreadAction(action.action)
    ) {
      continue;
    }

    const threadId = normalizeNonBlankString(action.threadId);
    const requiredEffect = normalizeNonBlankString(action.requiredEffect);
    if (!threadId || !requiredEffect) {
      continue;
    }

    normalized.push({
      bookId,
      volumeIndex: action.volumeIndex,
      chapterIndex: action.chapterIndex,
      threadId,
      action: action.action,
      requiredEffect,
    });
  }

  return normalized;
}

export function normalizeChapterCharacterPressures(
  bookId: string,
  pressures: unknown
): ChapterCharacterPressure[] {
  if (!Array.isArray(pressures)) {
    return [];
  }

  const normalized: ChapterCharacterPressure[] = [];
  for (const pressure of pressures) {
    if (
      !isRecord(pressure) ||
      !isPositiveInteger(pressure.volumeIndex) ||
      !isPositiveInteger(pressure.chapterIndex)
    ) {
      continue;
    }

    const characterId = normalizeNonBlankString(pressure.characterId);
    const desirePressure = normalizeNonBlankString(pressure.desirePressure);
    const fearPressure = normalizeNonBlankString(pressure.fearPressure);
    const flawTrigger = normalizeNonBlankString(pressure.flawTrigger);
    const expectedChoice = normalizeNonBlankString(pressure.expectedChoice);
    if (
      !characterId ||
      !desirePressure ||
      !fearPressure ||
      !flawTrigger ||
      !expectedChoice
    ) {
      continue;
    }

    normalized.push({
      bookId,
      volumeIndex: pressure.volumeIndex,
      chapterIndex: pressure.chapterIndex,
      characterId,
      desirePressure,
      fearPressure,
      flawTrigger,
      expectedChoice,
    });
  }

  return normalized;
}

export function normalizeChapterRelationshipActions(
  bookId: string,
  actions: unknown
): ChapterRelationshipAction[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  const normalized: ChapterRelationshipAction[] = [];
  for (const action of actions) {
    if (
      !isRecord(action) ||
      !isPositiveInteger(action.volumeIndex) ||
      !isPositiveInteger(action.chapterIndex) ||
      !isRelationshipAction(action.action)
    ) {
      continue;
    }

    const relationshipId = normalizeNonBlankString(action.relationshipId);
    const requiredChange = normalizeNonBlankString(action.requiredChange);
    if (!relationshipId || !requiredChange) {
      continue;
    }

    normalized.push({
      bookId,
      volumeIndex: action.volumeIndex,
      chapterIndex: action.chapterIndex,
      relationshipId,
      action: action.action,
      requiredChange,
    });
  }

  return normalized;
}
