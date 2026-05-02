import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { plotThreads } from '../db/schema/index.js';

export function createPlotThreadRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    upsertThread(input: {
      id: string;
      bookId: string;
      description: string;
      plantedAt: number;
      expectedPayoff?: number | null;
      resolvedAt?: number | null;
      importance?: string | null;
    }) {
      drizzleDb
        .insert(plotThreads)
        .values({
          ...input,
          expectedPayoff: input.expectedPayoff ?? null,
          resolvedAt: input.resolvedAt ?? null,
          importance: input.importance ?? 'normal',
        })
        .onConflictDoUpdate({
          target: plotThreads.id,
          set: {
            description: input.description,
            plantedAt: input.plantedAt,
            expectedPayoff: input.expectedPayoff ?? null,
            resolvedAt: input.resolvedAt ?? null,
            importance: input.importance ?? 'normal',
          },
        })
        .run();
    },

    resolveThread(id: string, resolvedAt: number) {
      drizzleDb
        .update(plotThreads)
        .set({ resolvedAt })
        .where(eq(plotThreads.id, id))
        .run();
    },

    listByBook(bookId: string) {
      return drizzleDb
        .select({
          id: plotThreads.id,
          bookId: plotThreads.bookId,
          description: plotThreads.description,
          plantedAt: plotThreads.plantedAt,
          expectedPayoff: plotThreads.expectedPayoff,
          resolvedAt: plotThreads.resolvedAt,
          importance: plotThreads.importance,
        })
        .from(plotThreads)
        .where(eq(plotThreads.bookId, bookId))
        .orderBy(asc(plotThreads.plantedAt), asc(plotThreads.id))
        .all() as Array<{
        id: string;
        bookId: string;
        description: string;
        plantedAt: number;
        expectedPayoff: number | null;
        resolvedAt: number | null;
        importance: string;
      }>;
    },

    clearByBook(bookId: string) {
      drizzleDb.delete(plotThreads).where(eq(plotThreads.bookId, bookId)).run();
    },
  };
}
