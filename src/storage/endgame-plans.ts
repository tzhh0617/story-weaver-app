import { eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { endgamePlans } from '../db/schema/index.js';

export function createEndgamePlanRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: {
      bookId: string;
      titleIdeaContract: string;
      protagonistEndState: string;
      finalConflict: string;
      finalOpponent: string;
      worldEndState: string;
      coreCharacterOutcomes: unknown;
      majorPayoffs: unknown;
    }) {
      const now = new Date().toISOString();

      drizzleDb
        .insert(endgamePlans)
        .values({
          bookId: input.bookId,
          titleIdeaContract: input.titleIdeaContract,
          protagonistEndState: input.protagonistEndState,
          finalConflict: input.finalConflict,
          finalOpponent: input.finalOpponent,
          worldEndState: input.worldEndState,
          coreCharacterOutcomesJson: JSON.stringify(input.coreCharacterOutcomes),
          majorPayoffsJson: JSON.stringify(input.majorPayoffs),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: endgamePlans.bookId,
          set: {
            titleIdeaContract: input.titleIdeaContract,
            protagonistEndState: input.protagonistEndState,
            finalConflict: input.finalConflict,
            finalOpponent: input.finalOpponent,
            worldEndState: input.worldEndState,
            coreCharacterOutcomesJson: JSON.stringify(input.coreCharacterOutcomes),
            majorPayoffsJson: JSON.stringify(input.majorPayoffs),
            updatedAt: now,
          },
        })
        .run();
    },

    getByBook(bookId: string) {
      const row = drizzleDb
        .select({
          bookId: endgamePlans.bookId,
          titleIdeaContract: endgamePlans.titleIdeaContract,
          protagonistEndState: endgamePlans.protagonistEndState,
          finalConflict: endgamePlans.finalConflict,
          finalOpponent: endgamePlans.finalOpponent,
          worldEndState: endgamePlans.worldEndState,
          coreCharacterOutcomesJson: endgamePlans.coreCharacterOutcomesJson,
          majorPayoffsJson: endgamePlans.majorPayoffsJson,
          createdAt: endgamePlans.createdAt,
          updatedAt: endgamePlans.updatedAt,
        })
        .from(endgamePlans)
        .where(eq(endgamePlans.bookId, bookId))
        .get() as
        | {
            bookId: string;
            titleIdeaContract: string;
            protagonistEndState: string;
            finalConflict: string;
            finalOpponent: string;
            worldEndState: string;
            coreCharacterOutcomesJson: string;
            majorPayoffsJson: string;
            createdAt: string;
            updatedAt: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        bookId: row.bookId,
        titleIdeaContract: row.titleIdeaContract,
        protagonistEndState: row.protagonistEndState,
        finalConflict: row.finalConflict,
        finalOpponent: row.finalOpponent,
        worldEndState: row.worldEndState,
        coreCharacterOutcomes: JSON.parse(row.coreCharacterOutcomesJson) as unknown,
        majorPayoffs: JSON.parse(row.majorPayoffsJson) as unknown,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },
  };
}
