import { asc, desc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { relationshipStates } from '../db/schema/index.js';
import type {
  RelationshipStateInput,
  RelationshipStateOutput,
} from '../core/narrative/types.js';

export function createRelationshipStateRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: RelationshipStateInput) {
      drizzleDb
        .insert(relationshipStates)
        .values({
          ...input,
          changeSummary: input.changeSummary ?? null,
        })
        .onConflictDoUpdate({
          target: [
            relationshipStates.bookId,
            relationshipStates.relationshipId,
            relationshipStates.volumeIndex,
            relationshipStates.chapterIndex,
          ],
          set: {
            trustLevel: input.trustLevel,
            tensionLevel: input.tensionLevel,
            currentState: input.currentState,
            changeSummary: input.changeSummary ?? null,
          },
        })
        .run();
    },

    listLatestByBook(bookId: string): RelationshipStateOutput[] {
      return drizzleDb
        .select({
          bookId: relationshipStates.bookId,
          relationshipId: relationshipStates.relationshipId,
          volumeIndex: relationshipStates.volumeIndex,
          chapterIndex: relationshipStates.chapterIndex,
          trustLevel: relationshipStates.trustLevel,
          tensionLevel: relationshipStates.tensionLevel,
          currentState: relationshipStates.currentState,
          changeSummary: relationshipStates.changeSummary,
        })
        .from(relationshipStates)
        .where(eq(relationshipStates.bookId, bookId))
        .orderBy(
          asc(relationshipStates.relationshipId),
          desc(relationshipStates.volumeIndex),
          desc(relationshipStates.chapterIndex)
        )
        .all()
        .filter(
          (row, index, rows) =>
            index === 0 || rows[index - 1]?.relationshipId !== row.relationshipId
        ) as RelationshipStateOutput[];
    },
  };
}
