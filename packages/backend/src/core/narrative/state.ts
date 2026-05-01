import type {
  CharacterStateInput,
  NarrativeStateDelta,
  NarrativeThreadState,
  RelationshipStateInput,
} from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') {
    return null;
  }

  return trimmed;
}

function requiredString(value: unknown) {
  return nullableString(value);
}

function nullableNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

const threadStates = new Set<NarrativeThreadState>([
  'open',
  'advanced',
  'twisted',
  'paid_off',
  'abandoned',
]);

function normalizeCharacterState(value: unknown): CharacterStateInput | null {
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
    arcPhase: nullableString(value.arcPhase),
  } as CharacterStateInput;
}

function normalizeRelationshipState(value: unknown): RelationshipStateInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const relationshipId = requiredString(value.relationshipId);
  const trustLevel = nullableNumber(value.trustLevel);
  const tensionLevel = nullableNumber(value.tensionLevel);
  const currentState = requiredString(value.currentState);
  if (!relationshipId || trustLevel === null || tensionLevel === null || !currentState) {
    return null;
  }

  return {
    relationshipId,
    trustLevel,
    tensionLevel,
    currentState,
    changeSummary: nullableString(value.changeSummary),
  } as RelationshipStateInput;
}

function normalizeThreadUpdate(
  value: unknown
): NarrativeStateDelta['threadUpdates'][number] | null {
  if (!isRecord(value)) {
    return null;
  }

  const threadId = requiredString(value.threadId);
  const currentState =
    typeof value.currentState === 'string' && threadStates.has(value.currentState as NarrativeThreadState)
      ? (value.currentState as NarrativeThreadState)
      : null;
  if (!threadId || !currentState) {
    return null;
  }

  return {
    threadId,
    currentState,
    resolvedAt: nullableNumber(value.resolvedAt),
    notes: nullableString(value.notes),
  };
}

function normalizeScene(value: unknown): NarrativeStateDelta['scene'] {
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

export function normalizeNarrativeStateDelta(
  input: unknown
): NarrativeStateDelta {
  const delta = isRecord(input) ? input : {};

  return {
    characterStates: Array.isArray(delta.characterStates)
      ? delta.characterStates.map(normalizeCharacterState).filter(isPresent)
      : [],
    relationshipStates: Array.isArray(delta.relationshipStates)
      ? delta.relationshipStates.map(normalizeRelationshipState).filter(isPresent)
      : [],
    threadUpdates: Array.isArray(delta.threadUpdates)
      ? delta.threadUpdates.map(normalizeThreadUpdate).filter(isPresent)
      : [],
    scene: normalizeScene(delta.scene),
    themeProgression: nullableString(delta.themeProgression) ?? '',
  };
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
