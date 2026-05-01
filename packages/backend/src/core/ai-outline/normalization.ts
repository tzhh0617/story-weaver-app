import type {
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterThreadAction,
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
