import type { NarrativeStateDelta } from './types.js';

export function normalizeNarrativeStateDelta(
  input: Partial<NarrativeStateDelta>
): NarrativeStateDelta {
  return {
    characterStates: Array.isArray(input.characterStates)
      ? input.characterStates
      : [],
    relationshipStates: Array.isArray(input.relationshipStates)
      ? input.relationshipStates
      : [],
    threadUpdates: Array.isArray(input.threadUpdates) ? input.threadUpdates : [],
    scene: input.scene ?? null,
    themeProgression: input.themeProgression ?? '',
  };
}
