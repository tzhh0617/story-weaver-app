import { randomUUID } from 'node:crypto';

import type {
  StoryEvent,
  StoryEventType,
  StoryLedger,
  StoryLedgerDigest,
} from './types.js';

type StoryEventInput = Omit<StoryEvent, 'id' | 'createdAt' | 'affectedIds'> & {
  affectedIds?: string[];
  id?: string;
  createdAt?: string;
};

type StoryLedgerInput = Omit<StoryLedger, 'createdAt'> & {
  createdAt?: string;
};

function dedupeStrings(values: string[] | undefined) {
  return [...new Set((values ?? []).filter((value) => value.length > 0))];
}

function isStoryEventType(value: string): value is StoryEventType {
  return [
    'mainline_advance',
    'subplot_shift',
    'promise_opened',
    'promise_paid',
    'character_turn',
    'relationship_turn',
    'world_change',
    'cost_paid',
  ].includes(value);
}

export function normalizeStoryEvent(input: StoryEventInput): StoryEvent {
  return {
    id: input.id ?? randomUUID(),
    bookId: input.bookId,
    chapterIndex: input.chapterIndex,
    eventType: isStoryEventType(input.eventType)
      ? input.eventType
      : 'mainline_advance',
    summary: input.summary.trim(),
    affectedIds: dedupeStrings(input.affectedIds),
    irreversible: Boolean(input.irreversible),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function normalizeStoryLedger(input: StoryLedgerInput): StoryLedger {
  return {
    ...input,
    mainlineProgress: input.mainlineProgress.trim(),
    activeSubplots: [...input.activeSubplots],
    openPromises: [...input.openPromises],
    characterTruths: [...input.characterTruths],
    relationshipDeltas: [...input.relationshipDeltas],
    worldFacts: [...input.worldFacts],
    riskFlags: [...input.riskFlags],
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function buildStoryLedgerDigest(ledger: StoryLedger): StoryLedgerDigest {
  return {
    mainlineProgress: ledger.mainlineProgress,
    openPromises: [...ledger.openPromises],
    rhythmPosition: ledger.rhythmPosition,
    riskFlags: [...ledger.riskFlags],
  };
}
