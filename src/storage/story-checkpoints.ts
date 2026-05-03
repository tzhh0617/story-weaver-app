import { desc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { storyCheckpoints } from '../db/schema/index.js';

export type StoryCheckpoint = {
  bookId: string;
  chapterIndex: number;
  checkpointType: string;
  contractDigest: string;
  planDigest: string;
  ledgerDigest: unknown;
};

export function createStoryCheckpointRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: StoryCheckpoint) {
      const createdAt = new Date().toISOString();

      drizzleDb
        .insert(storyCheckpoints)
        .values({
          bookId: input.bookId,
          chapterIndex: input.chapterIndex,
          checkpointType: input.checkpointType,
          contractDigest: input.contractDigest,
          planDigest: input.planDigest,
          ledgerDigestJson: JSON.stringify(input.ledgerDigest),
          createdAt,
        })
        .onConflictDoUpdate({
          target: [
            storyCheckpoints.bookId,
            storyCheckpoints.chapterIndex,
            storyCheckpoints.checkpointType,
          ],
          set: {
            contractDigest: input.contractDigest,
            planDigest: input.planDigest,
            ledgerDigestJson: JSON.stringify(input.ledgerDigest),
            createdAt,
          },
        })
        .run();
    },

    getLatestByBook(bookId: string) {
      const row = drizzleDb
        .select({
          bookId: storyCheckpoints.bookId,
          chapterIndex: storyCheckpoints.chapterIndex,
          checkpointType: storyCheckpoints.checkpointType,
          contractDigest: storyCheckpoints.contractDigest,
          planDigest: storyCheckpoints.planDigest,
          ledgerDigestJson: storyCheckpoints.ledgerDigestJson,
          createdAt: storyCheckpoints.createdAt,
        })
        .from(storyCheckpoints)
        .where(eq(storyCheckpoints.bookId, bookId))
        .orderBy(desc(storyCheckpoints.chapterIndex), desc(storyCheckpoints.createdAt))
        .limit(1)
        .get() as
        | {
            bookId: string;
            chapterIndex: number;
            checkpointType: string;
            contractDigest: string;
            planDigest: string;
            ledgerDigestJson: string;
            createdAt: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        bookId: row.bookId,
        chapterIndex: row.chapterIndex,
        checkpointType: row.checkpointType,
        contractDigest: row.contractDigest,
        planDigest: row.planDigest,
        ledgerDigest: JSON.parse(row.ledgerDigestJson) as unknown,
        createdAt: row.createdAt,
      };
    },
  };
}
