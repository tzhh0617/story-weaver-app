import { desc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { sceneRecords } from '../db/schema/index.js';

export function createSceneRecordRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      location: string;
      timeInStory: string;
      charactersPresent: string[];
      events?: string | null;
    }) {
      drizzleDb
        .insert(sceneRecords)
        .values({
          ...input,
          charactersPresent: JSON.stringify(input.charactersPresent),
          events: input.events ?? null,
        })
        .run();
    },

    getLatestByBook(bookId: string) {
      const row = drizzleDb
        .select({
          bookId: sceneRecords.bookId,
          volumeIndex: sceneRecords.volumeIndex,
          chapterIndex: sceneRecords.chapterIndex,
          location: sceneRecords.location,
          timeInStory: sceneRecords.timeInStory,
          charactersPresentJson: sceneRecords.charactersPresent,
          events: sceneRecords.events,
        })
        .from(sceneRecords)
        .where(eq(sceneRecords.bookId, bookId))
        .orderBy(
          desc(sceneRecords.volumeIndex),
          desc(sceneRecords.chapterIndex),
          desc(sceneRecords.id)
        )
        .limit(1)
        .get() as
        | {
            bookId: string;
            volumeIndex: number;
            chapterIndex: number;
            location: string;
            timeInStory: string;
            charactersPresentJson: string;
            events: string | null;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        bookId: row.bookId,
        volumeIndex: row.volumeIndex,
        chapterIndex: row.chapterIndex,
        location: row.location,
        timeInStory: row.timeInStory,
        charactersPresent: JSON.parse(row.charactersPresentJson) as string[],
        events: row.events,
      };
    },

    clearByBook(bookId: string) {
      drizzleDb.delete(sceneRecords).where(eq(sceneRecords.bookId, bookId)).run();
    },
  };
}
