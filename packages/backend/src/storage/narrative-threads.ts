import type { Database as SqliteDatabase } from 'better-sqlite3';

export type NarrativeThreadType =
  | 'main'
  | 'subplot'
  | 'relationship'
  | 'mystery'
  | 'theme'
  | 'antagonist'
  | 'world';

export type NarrativeThreadState =
  | 'open'
  | 'advanced'
  | 'twisted'
  | 'paid_off'
  | 'abandoned';

export type ThreadImportance = 'critical' | 'normal' | 'minor';
export type PayoffChangeTarget =
  | 'plot'
  | 'relationship'
  | 'world'
  | 'character'
  | 'theme';

export type NarrativeThread = {
  id: string;
  type: NarrativeThreadType;
  promise: string;
  plantedAt: number;
  expectedPayoff: number | null;
  resolvedAt: number | null;
  currentState: NarrativeThreadState;
  importance: ThreadImportance;
  payoffMustChange: PayoffChangeTarget;
  ownerCharacterId: string | null;
  relatedRelationshipId: string | null;
  notes: string | null;
};

export function createNarrativeThreadRepository(db: SqliteDatabase) {
  function upsertThread(bookId: string, thread: NarrativeThread) {
    db.prepare(
      `
        INSERT INTO narrative_threads (
          id, book_id, type, promise, planted_at, expected_payoff, resolved_at,
          current_state, importance, payoff_must_change, owner_character_id,
          related_relationship_id, notes
        )
        VALUES (
          @id, @bookId, @type, @promise, @plantedAt, @expectedPayoff, @resolvedAt,
          @currentState, @importance, @payoffMustChange, @ownerCharacterId,
          @relatedRelationshipId, @notes
        )
        ON CONFLICT(book_id, id) DO UPDATE SET
          type = excluded.type,
          promise = excluded.promise,
          planted_at = excluded.planted_at,
          expected_payoff = excluded.expected_payoff,
          resolved_at = excluded.resolved_at,
          current_state = excluded.current_state,
          importance = excluded.importance,
          payoff_must_change = excluded.payoff_must_change,
          owner_character_id = excluded.owner_character_id,
          related_relationship_id = excluded.related_relationship_id,
          notes = excluded.notes
      `
    ).run({ ...thread, bookId });
  }

  return {
    upsertMany(bookId: string, threads: NarrativeThread[]) {
      for (const thread of threads) upsertThread(bookId, thread);
    },

    upsertThread,

    resolveThread(bookId: string, threadId: string, resolvedAt: number) {
      db.prepare(
        `
          UPDATE narrative_threads
          SET resolved_at = ?, current_state = 'paid_off'
          WHERE book_id = ? AND id = ?
        `
      ).run(resolvedAt, bookId, threadId);
    },

    listByBook(bookId: string): NarrativeThread[] {
      return db
        .prepare(
          `
            SELECT
              id,
              type,
              promise,
              planted_at AS plantedAt,
              expected_payoff AS expectedPayoff,
              resolved_at AS resolvedAt,
              current_state AS currentState,
              importance,
              payoff_must_change AS payoffMustChange,
              owner_character_id AS ownerCharacterId,
              related_relationship_id AS relatedRelationshipId,
              notes
            FROM narrative_threads
            WHERE book_id = ?
            ORDER BY planted_at ASC, id ASC
          `
        )
        .all(bookId) as NarrativeThread[];
    },
  };
}
