export type ChapterUpdateJson = {
  summary?: string;
  openedThreads?: Array<{
    id: string;
    description: string;
    plantedAt: number;
    expectedPayoff: number | null;
    importance: string;
  }>;
  resolvedThreadIds?: string[];
  characterStates?: Array<{
    characterId: string;
    characterName: string;
    location: string | null;
    status: string | null;
    knowledge: string | null;
    emotion: string | null;
    powerLevel: string | null;
  }>;
  scene?: {
    location: string;
    timeInStory: string;
    charactersPresent: string[];
    events: string | null;
  } | null;
};

export function stripCodeFences(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

export function parseJson<T>(text: string): T {
  return JSON.parse(stripCodeFences(text)) as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function nullableString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') {
    return null;
  }

  return trimmed;
}

export function requiredString(value: unknown) {
  return nullableString(value);
}

export function nullableNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' && value.trim().toLowerCase() === 'null') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeImportance(value: unknown) {
  const normalized = nullableString(value);
  return normalized === 'critical' ||
    normalized === 'normal' ||
    normalized === 'minor'
    ? normalized
    : 'normal';
}

export function normalizeOpenedThread(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const id = requiredString(value.id);
  const description = requiredString(value.description);
  const plantedAt = nullableNumber(value.plantedAt);
  if (!id || !description || plantedAt === null) {
    return null;
  }

  return {
    id,
    description,
    plantedAt,
    expectedPayoff: nullableNumber(value.expectedPayoff),
    importance: normalizeImportance(value.importance),
  };
}

export function normalizeCharacterState(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const characterId = requiredString(value.characterId);
  const characterName = requiredString(value.characterName);
  if (!characterId || !characterName) {
    return null;
  }

  return {
    characterId,
    characterName,
    location: nullableString(value.location),
    status: nullableString(value.status),
    knowledge: nullableString(value.knowledge),
    emotion: nullableString(value.emotion),
    powerLevel: nullableString(value.powerLevel),
  };
}

export function normalizeScene(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const location = requiredString(value.location);
  const timeInStory = requiredString(value.timeInStory);
  const charactersPresent = Array.isArray(value.charactersPresent)
    ? value.charactersPresent
        .map((character) => requiredString(character))
        .filter((character): character is string => Boolean(character))
    : [];

  if (!location || !timeInStory || charactersPresent.length === 0) {
    return null;
  }

  return {
    location,
    timeInStory,
    charactersPresent,
    events: nullableString(value.events),
  };
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

export function normalizePlotThreadUpdate(update: {
  openedThreads?: unknown;
  resolvedThreadIds?: unknown;
}) {
  return {
    openedThreads: Array.isArray(update.openedThreads)
      ? update.openedThreads.map(normalizeOpenedThread).filter(isPresent)
      : [],
    resolvedThreadIds: Array.isArray(update.resolvedThreadIds)
      ? update.resolvedThreadIds
          .map((threadId) => requiredString(threadId))
          .filter((threadId): threadId is string => Boolean(threadId))
      : [],
  };
}

export function normalizeCharacterStates(characterStates: unknown) {
  return Array.isArray(characterStates)
    ? characterStates.map(normalizeCharacterState).filter(isPresent)
    : [];
}

export function normalizeChapterUpdate(update: ChapterUpdateJson) {
  const threadUpdate = normalizePlotThreadUpdate(update);

  return {
    summary: nullableString(update.summary) ?? '',
    openedThreads: threadUpdate.openedThreads,
    resolvedThreadIds: threadUpdate.resolvedThreadIds,
    characterStates: normalizeCharacterStates(update.characterStates),
    scene: normalizeScene(update.scene),
  };
}
