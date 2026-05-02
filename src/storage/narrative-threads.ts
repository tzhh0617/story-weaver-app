import { and, asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { narrativeThreads } from '../db/schema/index.js';
import type { NarrativeThread } from '../core/narrative/types.js';

export function createNarrativeThreadRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  function upsertThread(bookId: string, thread: NarrativeThread) {
    drizzleDb
      .insert(narrativeThreads)
      .values({ ...thread, bookId })
      .onConflictDoUpdate({
        target: narrativeThreads.id,
        set: {
          type: thread.type,
          promise: thread.promise,
          plantedAt: thread.plantedAt,
          expectedPayoff: thread.expectedPayoff ?? null,
          resolvedAt: thread.resolvedAt ?? null,
          currentState: thread.currentState,
          importance: thread.importance,
          payoffMustChange: thread.payoffMustChange,
          ownerCharacterId: thread.ownerCharacterId ?? null,
          relatedRelationshipId: thread.relatedRelationshipId ?? null,
          notes: thread.notes ?? null,
        },
      })
      .run();
  }

  return {
    upsertMany(bookId: string, threads: NarrativeThread[]) {
      for (const thread of threads) upsertThread(bookId, thread);
    },

    upsertThread,

    resolveThread(bookId: string, threadId: string, resolvedAt: number) {
      drizzleDb
        .update(narrativeThreads)
        .set({ resolvedAt, currentState: 'paid_off' })
        .where(
          and(
            eq(narrativeThreads.bookId, bookId),
            eq(narrativeThreads.id, threadId)
          )
        )
        .run();
    },

    listByBook(bookId: string): NarrativeThread[] {
      return drizzleDb
        .select({
          id: narrativeThreads.id,
          type: narrativeThreads.type,
          promise: narrativeThreads.promise,
          plantedAt: narrativeThreads.plantedAt,
          expectedPayoff: narrativeThreads.expectedPayoff,
          resolvedAt: narrativeThreads.resolvedAt,
          currentState: narrativeThreads.currentState,
          importance: narrativeThreads.importance,
          payoffMustChange: narrativeThreads.payoffMustChange,
          ownerCharacterId: narrativeThreads.ownerCharacterId,
          relatedRelationshipId: narrativeThreads.relatedRelationshipId,
          notes: narrativeThreads.notes,
        })
        .from(narrativeThreads)
        .where(eq(narrativeThreads.bookId, bookId))
        .orderBy(asc(narrativeThreads.plantedAt), asc(narrativeThreads.id))
        .all() as NarrativeThread[];
    },
  };
}
